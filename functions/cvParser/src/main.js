/**
 * cvParser — Appwrite Background Function
 *
 * Triggered by: buckets.cvs.files.*.create
 *
 * Flow:
 *  1. Appwrite event contains the file ID and user ID in the path + payload.
 *  2. We download the file from the "cvs" Storage bucket.
 *  3. We parse text from PDF (.pdf), Word (.docx), or plain text (.txt).
 *  4. We write the extracted text back to the user's profile row
 *     (cv_parsed_text, cv_indexed = true).
 *  5. That update triggers the profileSync function, which re-embeds the
 *     profile with the richer CV content appended to the semantic vector.
 *
 * NOTE: cv_file_id must be set on the profile BEFORE the file is uploaded
 * so the parser can find the right profile row. The frontend should:
 *   a) Upload file → get fileId
 *   b) Patch profile with cv_file_id = fileId
 *   c) Upload the actual file bytes (Appwrite Storage)
 *      The event fires after (c) completes.
 */

import { Client, TablesDB, Storage, Query } from 'node-appwrite';
import * as Sentry from '@sentry/node';

// Dynamic imports — loaded lazily so cold-start is fast for non-PDF/Docx files
let pdfParse;
let mammoth;

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://353d6976441e378c1fadef50b50a725c@o4510971097317376.ingest.de.sentry.io/4511229967990864",
  tracesSampleRate: 1.0,
});

const BUCKET_ID = 'cvs';
const DB_ID     = 'supercharged';
const TABLE_ID  = 'profiles';

// ── Text extractors ───────────────────────────────────────────────────────────

async function extractPdf(buffer) {
  if (!pdfParse) {
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = mod.default;
  }
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractDocx(buffer) {
  if (!mammoth) {
    const mod = await import('mammoth');
    mammoth = mod.default;
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractTxt(buffer) {
  return buffer.toString('utf-8');
}

async function extractText(buffer, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf':  return extractPdf(buffer);
    case 'docx':
    case 'doc':  return extractDocx(buffer);
    default:     return extractTxt(buffer);
  }
}

// ── Appwrite Helpers ──────────────────────────────────────────────────────────

/**
 * Find the profile row whose cv_file_id matches the uploaded file.
 * Falls back to matching by userId extracted from the Appwrite event path.
 */
async function findProfile(tables, fileId, userId) {
  // Primary: lookup by cv_file_id (most reliable)
  try {
    const res = await tables.listRows({
      databaseId: DB_ID,
      tableId:    TABLE_ID,
      queries:    [Query.equal('cv_file_id', fileId)],
    });
    if (res.rows?.length > 0) return res.rows[0];
  } catch (_) { /* ignore */ }

  // Fallback: lookup by user_id from event
  if (userId) {
    const res = await tables.listRows({
      databaseId: DB_ID,
      tableId:    TABLE_ID,
      queries:    [Query.equal('user_id', userId)],
    });
    if (res.rows?.length > 0) return res.rows[0];
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default async ({ req, res, log, error }) => {
  const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';

  const appwrite = new Client()
    .setEndpoint(endpoint)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const storage = new Storage(appwrite);
  const tables  = new TablesDB(appwrite);

  try {
    // ── Parse event ──────────────────────────────────────────────────────────
    const eventHeader = req.headers['x-appwrite-event'] || '';
    log(`CV Parser triggered — event: ${eventHeader}`);

    // Event format: buckets.cvs.files.<fileId>.create
    const eventParts = eventHeader.split('.');
    const fileId = eventParts[3] || null;

    // User ID can be in the trigger body if Appwrite sends it, otherwise null
    const body   = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userId = body.userId || body.$userId || body.user_id || null;

    if (!fileId) {
      error('No fileId found in event header. Cannot proceed.');
      return res.json({ success: false, error: 'No fileId in event' }, 400);
    }

    log(`File ID: ${fileId}`);

    // ── Download file from Storage ────────────────────────────────────────────
    let fileBuffer;
    let fileName = `cv_${fileId}`;

    try {
      // getFileDownload returns an ArrayBuffer in node-appwrite
      const downloaded = await storage.getFileDownload(BUCKET_ID, fileId);
      
      // Get file metadata for extension detection
      const fileMeta = await storage.getFile(BUCKET_ID, fileId);
      fileName = fileMeta.name || fileName;

      // Convert ArrayBuffer → Node Buffer
      fileBuffer = Buffer.from(downloaded);
      log(`Downloaded: ${fileName} (${fileBuffer.length} bytes)`);
    } catch (dlErr) {
      error(`Failed to download file ${fileId}: ${dlErr.message}`);
      Sentry.captureException(dlErr);
      return res.json({ success: false, error: `Download failed: ${dlErr.message}` }, 500);
    }

    // ── Extract text ──────────────────────────────────────────────────────────
    let parsedText = '';
    try {
      parsedText = await extractText(fileBuffer, fileName);
      // Clean up whitespace, cap at 50k chars (column limit)
      parsedText = parsedText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 49000);
      log(`Extracted ${parsedText.length} chars from ${fileName}`);
    } catch (parseErr) {
      error(`Text extraction failed for ${fileName}: ${parseErr.message}`);
      // Non-fatal: store empty text rather than crashing
      parsedText = '';
    }

    // ── Find profile row ──────────────────────────────────────────────────────
    const profile = await findProfile(tables, fileId, userId);

    if (!profile) {
      error(`No profile found for fileId=${fileId}, userId=${userId}`);
      return res.json({ success: false, error: 'Profile not found' }, 404);
    }

    log(`Found profile: ${profile.$id} (user: ${profile.user_id})`);

    // ── Write parsed text + mark cv_indexed = true ────────────────────────────
    // Setting cv_indexed=true AND is_indexed=false ensures profileSync will
    // re-embed this profile with the new CV content included in the semantic vector.
    await tables.updateRow({
      databaseId: DB_ID,
      tableId:    TABLE_ID,
      rowId:      profile.$id,
      data: {
        cv_parsed_text: parsedText,
        cv_indexed:     true,
        // Reset is_indexed so profileSync will re-run the full embed
        is_indexed:     false,
      }
    });

    log(`Profile ${profile.$id} updated with CV text. profileSync will re-embed.`);
    return res.json({ success: true, message: 'CV parsed and profile queued for re-embedding.' });

  } catch (err) {
    error('=== CV PARSER ERROR ===');
    error('Message: ' + err.message);
    if (err.stack) error(err.stack);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return res.json({ success: false, error: err.message }, 500);
  }
};
