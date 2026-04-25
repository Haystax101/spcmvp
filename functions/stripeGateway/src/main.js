import { Client, TablesDB, Query, ID, Permission, Role } from 'node-appwrite';
import Stripe from 'stripe';
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

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

  // 2. Determine Price/Mode via lookup map
  const PACKAGE_CONFIG = {
    spark:  { env: 'STRIPE_PRICE_ID_SPARK',  voltz: 300,  mode: 'subscription', sub: true },
    zenith: { env: 'STRIPE_PRICE_ID_ZENITH', voltz: 1000, mode: 'subscription', sub: true },
  };

  const config = PACKAGE_CONFIG[packageName];
  if (!config) throw new Error(`Unknown package: ${packageName}`);

  const priceId = process.env[config.env];
  if (!priceId) throw new Error(`Price ID not configured for package: ${packageName} (env: ${config.env})`);

  // 3. Create Session with Blueprint specific parameters
  const qty = config.sub ? 1 : parseInt(quantity || '1');
  const voltzToAdd = config.sub ? config.voltz : config.voltz * qty;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: config.mode,
    line_items: [
      {
        price: priceId,
        quantity: qty,
      },
    ],
    managed_payments: {
      enabled: true,
    },
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      package: packageName,
      voltz_to_add: voltzToAdd.toString()
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

    // 2. Duplicate check — guarded because stripe_session_id column may not exist yet in the schema.
    // Once the column is added in Appwrite, this will correctly prevent double-credits on retries.
    let alreadyProcessed = false;
    try {
      const existing = await tablesDB.listRows({
        databaseId: dbId,
        tableId: ledgerTable,
        queries: [
          Query.equal("stripe_session_id", [session.id]),
          Query.limit(1)
        ]
      });
      if (existing.total > 0) return { received: true, status: 'already_processed' };
    } catch (dupErr) {
      // Attribute not yet in schema — skip duplicate check, proceed to credit
      log(`Duplicate check skipped: ${dupErr.message}`);
    }

    if (alreadyProcessed) return { received: true, status: 'already_processed' };

    // 3. Update Balance
    const bonusVoltz = 100; // Always give 100 bonus voltz on purchase
    const totalVoltzToAdd = voltzToAdd + bonusVoltz;
    const nextBalance = (profile.current_voltz || 0) + totalVoltzToAdd;
    const updates = { current_voltz: nextBalance };

    const subPackages = ['pro', 'luminary', 'zenith'];
    if (subPackages.includes(packageName)) {
      updates.stripe_subscription_id = session.subscription || '';
    }

    await tablesDB.updateRow({
      databaseId: dbId,
      tableId: profileTable,
      rowId: profile.$id,
      data: updates
    });

    // 4. Log to Ledger — stripe_session_id is omitted if the column doesn't exist yet
    const ledgerData = {
      profile_row_id: profile.$id,
      amount: voltzToAdd,
      event_type: 'purchase',
      reason: `Stripe Purchase: ${packageName}`,
      awarded_at: new Date().toISOString(),
    };

    // Add row-level permissions so user can read their own ledger entry
    const permissions = profile.user_id ? [Permission.read(Role.user(profile.user_id))] : [];

    try {
      await tablesDB.createRow({
        databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(),
        data: { ...ledgerData, stripe_session_id: session.id },
        permissions
      });
    } catch (writeErr) {
      if (/Attribute not found/i.test(writeErr.message)) {
        // stripe_session_id column missing — write without it
        await tablesDB.createRow({
          databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(),
          data: ledgerData,
          permissions
        });
      } else {
        throw writeErr;
      }
    }

    // Log bonus voltz
    const bonusLedgerData = {
      profile_row_id: profile.$id,
      amount: bonusVoltz,
      event_type: 'purchase_bonus',
      reason: `Stripe Purchase Bonus: ${packageName}`,
      awarded_at: new Date().toISOString(),
    };

    try {
      await tablesDB.createRow({
        databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(),
        data: bonusLedgerData,
        permissions
      });
    } catch (writeErr) {
      if (!/Attribute not found/i.test(writeErr.message)) {
        throw writeErr;
      }
    }

    return { received: true, status: 'credited', amount: voltzToAdd, bonusVoltz, totalVoltz: totalVoltzToAdd };
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

  try {
    const existing = await tablesDB.listRows({
      databaseId: dbId, tableId: ledgerTable,
      queries: [Query.equal('stripe_session_id', [session.id]), Query.limit(1)],
    });
    if (existing.total > 0) return { verified: true, already_credited: true, current_voltz: profile.current_voltz };
  } catch {
    // stripe_session_id column not yet in schema — proceed to credit
  }

  const bonusVoltz = 100; // Always give 100 bonus voltz on purchase
  const totalVoltzToAdd = voltzToAdd + bonusVoltz;
  const nextBalance = (profile.current_voltz || 0) + totalVoltzToAdd;
  const updates = { current_voltz: nextBalance };
  const subPackages = ['pro', 'luminary', 'zenith'];
  if (subPackages.includes(packageName)) updates.stripe_subscription_id = session.subscription || '';

  await tablesDB.updateRow({ databaseId: dbId, tableId: profileTable, rowId: profile.$id, data: updates });

  // Create ledger entry for purchased voltz
  const ledgerData = {
    profile_row_id: profile.$id, amount: voltzToAdd,
    event_type: 'purchase', reason: `Stripe Purchase (verified): ${packageName}`,
    awarded_at: new Date().toISOString(),
  };

  // Add row-level permissions so user can read their own ledger entry
  const permissions = profile.user_id ? [Permission.read(Role.user(profile.user_id))] : [];

  try {
    await tablesDB.createRow({ databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(), data: { ...ledgerData, stripe_session_id: session.id }, permissions });
  } catch (writeErr) {
    if (/Attribute not found/i.test(writeErr.message)) {
      await tablesDB.createRow({ databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(), data: ledgerData, permissions });
    } else {
      throw writeErr;
    }
  }

  // Create ledger entry for bonus voltz
  const bonusLedgerData = {
    profile_row_id: profile.$id, amount: bonusVoltz,
    event_type: 'purchase_bonus', reason: `Stripe Purchase Bonus: ${packageName}`,
    awarded_at: new Date().toISOString(),
  };

  try {
    await tablesDB.createRow({ databaseId: dbId, tableId: ledgerTable, rowId: ID.unique(), data: bonusLedgerData, permissions });
  } catch (writeErr) {
    if (!/Attribute not found/i.test(writeErr.message)) {
      throw writeErr;
    }
  }

  return { verified: true, credited: true, amount: voltzToAdd, bonusVoltz, totalVoltz: totalVoltzToAdd, current_voltz: nextBalance };
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
    log(`[stripeGateway] Received action: ${action}, payload keys: ${Object.keys(payload).join(',')}`);

    if (action === 'create_checkout_session') {
      log(`[stripeGateway] Processing create_checkout_session for user ${payload.userId}, package ${payload.package}`);
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
    Sentry.captureException(err, {
      tags: {
        action: req.body?.action || 'unknown',
        function: 'stripeGateway'
      }
    });
    return res.json({ error: err.message }, 500);
  }
};
