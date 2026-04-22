import { Client, TablesDB, Query, ID } from 'node-appwrite';
import Stripe from 'stripe';

/**
 * Stripe Gateway Action: create_checkout_session
 * Blueprint version: 2026-02-25.preview
 */
async function actionCreateCheckoutSession({ stripe, tablesDB, dbId, profileTable, userId, packageName, successUrl, cancelUrl, quantity }) {
  // 1. Fetch user profile to get (or create) Stripe Customer ID
  const found = await tablesDB.listRows({
    databaseId: dbId,
    tableId: profileTable,
    queries: [
      Query.equal("user_id", [userId]),
      Query.limit(1)
    ]
  });
  const profile = found.rows[0];
  if (!profile) throw new Error("Profile not found");

  let customerId = profile.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email || '',
      name: `${profile.first_name} ${profile.last_name}`.trim(),
      metadata: { appwrite_user_id: userId }
    });
    customerId = customer.id;
    // Persist customer ID
    await tablesDB.updateRow({
      databaseId: dbId,
      tableId: profileTable,
      rowId: profile.$id,
      data: { stripe_customer_id: customerId }
    });
  }

  // 2. Determine Price/Mode
  const isPro = packageName === 'pro';
  const priceId = isPro 
    ? process.env.STRIPE_PRICE_ID_PRO 
    : process.env.STRIPE_PRICE_ID_TOPUP;

  if (!priceId) throw new Error(`Price ID not configured for package: ${packageName}`);

  // 3. Create Session with Blueprint specific parameters
  const qty = parseInt(quantity || '1');
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isPro ? 'subscription' : 'payment',
    line_items: [
      {
        price: priceId,
        quantity: qty,
      },
    ],
    managed_payments: {
      enabled: true,
    },
    client_reference_id: userId, // Official recommendation from tutorial
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      package: packageName,
      voltz_to_add: isPro ? '500' : (50 * qty).toString()
    }
  });

  return { url: session.url, session_id: session.id };
}


/**
 * Stripe Gateway Action: handle_stripe_webhook
 */
async function actionHandleWebhook({ stripe, tablesDB, dbId, profileTable, ledgerTable, body, signature, webhookSecret }) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata.user_id;
    const voltzToAdd = parseInt(session.metadata.voltz_to_add || '0');
    const packageName = session.metadata.package;

    if (!userId || voltzToAdd <= 0) return { received: true, skipped: true };

    // 1. Find profile
    const found = await tablesDB.listRows({
      databaseId: dbId,
      tableId: profileTable,
      queries: [
        Query.equal("user_id", [userId]),
        Query.limit(1)
      ]
    });
    const profile = found.rows[0];
    if (!profile) throw new Error("Profile for payment not found");

    // 2. Duplicate Check
    const existing = await tablesDB.listRows({
      databaseId: dbId,
      tableId: ledgerTable,
      queries: [
        Query.equal("stripe_session_id", [session.id]),
        Query.limit(1)
      ]
    });
    if (existing.total > 0) return { received: true, status: 'already_processed' };

    // 3. Update Balance
    const nextBalance = (profile.current_voltz || 0) + voltzToAdd;
    const updates = { current_voltz: nextBalance };
    
    if (packageName === 'pro') {
      updates.stripe_subscription_id = session.subscription || '';
    }

    await tablesDB.updateRow({
      databaseId: dbId,
      tableId: profileTable,
      rowId: profile.$id,
      data: updates
    });

    // 4. Log to Ledger
    await tablesDB.createRow({
      databaseId: dbId,
      tableId: ledgerTable,
      rowId: ID.unique(),
      data: {
        profile_row_id: profile.$id,
        amount: voltzToAdd,
        event_type: 'purchase',
        reason: `Stripe Purchase: ${packageName}`,
        awarded_at: new Date().toISOString(),
        stripe_session_id: session.id
      }
    });

    return { received: true, status: 'credited', amount: voltzToAdd };
  }

  return { received: true };
}

/**
 * Stripe Gateway Action: verify_session
 * Client-side fallback — verifies a completed session and credits Voltz if not already done.
 */
async function actionVerifySession({ stripe, tablesDB, dbId, profileTable, ledgerTable, sessionId }) {
  if (!sessionId) throw new Error('session_id is required');

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { verified: false, reason: 'payment_not_complete' };
  }

  const userId = session.client_reference_id || session.metadata?.user_id;
  const voltzToAdd = parseInt(session.metadata?.voltz_to_add || '0');
  const packageName = session.metadata?.package;

  if (!userId || voltzToAdd <= 0) return { verified: false, reason: 'missing_metadata' };

  const found = await tablesDB.listRows({
    databaseId: dbId, tableId: profileTable,
    queries: [Query.equal('user_id', [userId]), Query.limit(1)],
  });
  const profile = found.rows[0];
  if (!profile) throw new Error('Profile not found');

  const existing = await tablesDB.listRows({
    databaseId: dbId, tableId: ledgerTable,
    queries: [Query.equal('stripe_session_id', [session.id]), Query.limit(1)],
  });
  if (existing.total > 0) return { verified: true, already_credited: true, current_voltz: profile.current_voltz };

  const nextBalance = (profile.current_voltz || 0) + voltzToAdd;
  const updates = { current_voltz: nextBalance };
  if (packageName === 'pro') updates.stripe_subscription_id = session.subscription || '';

  await tablesDB.updateRow({ databaseId: dbId, tableId: profileTable, rowId: profile.$id, data: updates });
  await tablesDB.createRow({
    databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(),
    data: {
      profile_row_id: profile.$id, amount: voltzToAdd,
      event_type: 'purchase', reason: `Stripe Purchase (verified): ${packageName}`,
      awarded_at: new Date().toISOString(), stripe_session_id: session.id,
    },
  });

  return { verified: true, credited: true, amount: voltzToAdd, current_voltz: nextBalance };
}

export default async ({ req, res, log, error }) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.preview' // Strict Blueprint Version
  });

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const tablesDB = new TablesDB(client);
  const dbId = 'supercharged';
  const profileTable = 'profiles';
  const ledgerTable = 'voltz_ledger';

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action } = payload;

    if (action === 'create_checkout_session') {
      const result = await actionCreateCheckoutSession({
        stripe, tablesDB, dbId, profileTable,
        userId: payload.userId,
        packageName: payload.package,
        successUrl: payload.successUrl,
        cancelUrl: payload.cancelUrl,
        quantity: payload.quantity
      });
      return res.json(result);
    }

    if (action === 'verify_session') {
      const result = await actionVerifySession({
        stripe, tablesDB, dbId, profileTable, ledgerTable,
        sessionId: payload.session_id,
      });
      return res.json(result);
    }

    if (req.headers['stripe-signature']) {
      const result = await actionHandleWebhook({
        stripe, tablesDB, dbId, profileTable, ledgerTable,
        body: req.bodyRaw, // Appwrite provides raw body
        signature: req.headers['stripe-signature'],
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
      });
      return res.json(result);
    }

    return res.json({ error: "Invalid action or webhook signature missing" }, 400);
  } catch (err) {
    error(err.message);
    return res.json({ error: err.message }, 500);
  }
};
