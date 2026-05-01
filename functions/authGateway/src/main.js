import { Client, ID, Query, TablesDB } from 'node-appwrite';

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const MAGIC_LINK_TOKENS_TABLE = process.env.MAGIC_LINK_TOKENS_TABLE || 'magic_link_tokens';

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const ADMIN_EMAILS = [
  'gdwhastings559@gmail.com',
  'bowencheung0228@outlook.com',
  'joseph@tingala.plus.com',
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
  }
  return req.body || {};
}

function createTables() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID);

  // Use API key if provided (for local/admin use), otherwise function uses its own scopes
  if (process.env.APPWRITE_API_KEY) {
    client.setKey(process.env.APPWRITE_API_KEY);
  }

  return new TablesDB(client);
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  if (ADMIN_EMAILS.includes(lower)) return true;
  // Oxford email: must have a subdomain before ox.ac.uk (not bare @ox.ac.uk)
  return /^[^@]+@[^@]+\.ox\.ac\.uk$/.test(lower) && !lower.endsWith('@ox.ac.uk');
}

async function actionSendMagicLink({ tables, body }) {
  const email = (body.email || '').toLowerCase().trim();

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'A valid Oxford email address is required.');
  }

  const token = ID.unique();
  const tokenId = ID.unique();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  try {
    await tables.createRow({
      databaseId: DB_ID,
      tableId: MAGIC_LINK_TOKENS_TABLE,
      rowId: tokenId,
      data: { email, token, expires_at: expiresAt, is_used: false },
    });
  } catch (dbErr) {
    throw new HttpError(500, `Database error: ${dbErr?.message || 'Failed to store token'}`);
  }

  const appUrl = process.env.APP_URL || 'https://superchargedai.app/platform-beta';
  const from = process.env.RESEND_FROM_EMAIL || 'noreply@supercharged.ox.ac.uk';
  const magicLink = `${appUrl}?token=${token}${body.stateParams ? `&state=${body.stateParams}` : ''}`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new HttpError(500, 'Email service not configured (missing RESEND_API_KEY).');
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Your Supercharged sign-in link',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="font-size:24px;font-weight:300;margin-bottom:16px">Sign in to Supercharged</h2>
            <p style="color:#555;margin-bottom:24px">Click the button below to sign in. This link expires in 15 minutes.</p>
            <a href="${magicLink}" style="display:inline-block;background:#1A1A1A;color:#FFFEFD;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Sign in
            </a>
            <p style="color:#AAA;font-size:12px;margin-top:24px">
              If you didn't request this, you can ignore this email.<br/>
              Link: <a href="${magicLink}" style="color:#AAA">${magicLink}</a>
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const resendBody = await emailRes.text();
      throw new HttpError(502, `Resend API error (${emailRes.status}): ${resendBody}`);
    }
  } catch (emailErr) {
    if (emailErr instanceof HttpError) throw emailErr;
    throw new HttpError(500, `Email send failed: ${emailErr?.message || 'Unknown error'}`);
  }

  return { sent: true, pollingId: tokenId };
}

async function actionVerifyMagicLink({ tables, body }) {
  const token = (body.token || '').trim();
  if (!token) {
    throw new HttpError(400, 'token is required');
  }

  const res = await tables.listRows({
    databaseId: DB_ID,
    tableId: MAGIC_LINK_TOKENS_TABLE,
    queries: [Query.equal('token', token), Query.limit(1)],
  });

  const row = res.rows?.[0];
  if (!row) {
    throw new HttpError(404, 'Invalid or expired link.');
  }

  if (row.is_used) {
    throw new HttpError(410, 'This link has already been used.');
  }

  if (new Date(row.expires_at) < new Date()) {
    throw new HttpError(410, 'This link has expired. Please request a new one.');
  }

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: MAGIC_LINK_TOKENS_TABLE,
    rowId: row.$id,
    data: { is_used: true },
  });

  return { verified: true, email: row.email };
}

async function actionCheckMagicLinkStatus({ tables, body }) {
  const pollingId = (body.pollingId || '').trim();
  if (!pollingId) {
    throw new HttpError(400, 'pollingId is required');
  }

  try {
    const row = await tables.getRow({
      databaseId: DB_ID,
      tableId: MAGIC_LINK_TOKENS_TABLE,
      rowId: pollingId,
    });
    return { is_used: row.is_used };
  } catch (err) {
    throw new HttpError(404, 'Token not found');
  }
}

export default async ({ req, res, log, error }) => {
  const tables = createTables();

  try {
    const body = parseBody(req);
    const action = (body.action || '').trim();

    log(`[authGateway] action=${action}`);

    if (!action) {
      throw new HttpError(400, 'action is required');
    }

    let payload;
    switch (action) {
      case 'send_magic_link':
        log(`[authGateway] Processing send_magic_link for ${body.email}`);
        payload = await actionSendMagicLink({ tables, body });
        log(`[authGateway] Magic link sent successfully`);
        break;
      case 'verify_magic_link':
        log(`[authGateway] Processing verify_magic_link`);
        payload = await actionVerifyMagicLink({ tables, body });
        log(`[authGateway] Magic link verified successfully`);
        break;
      case 'check_magic_link_status':
        log(`[authGateway] Processing check_magic_link_status`);
        payload = await actionCheckMagicLinkStatus({ tables, body });
        break;
      default:
        throw new HttpError(400, `Unknown action: ${action}`);
    }

    return res.json({ ok: true, ...payload });
  } catch (err) {
    if (err instanceof HttpError) {
      error(`[authGateway] HTTP ${err.status}: ${err.message}`);
      return res.json({ ok: false, error: err.message }, err.status);
    }
    error(`[authGateway] ERROR: ${err?.message || String(err)}`);
    if (err?.stack) error(err.stack);
    return res.json({ ok: false, error: 'Internal error' }, 500);
  }
};

