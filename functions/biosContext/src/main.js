import { Client, Query, TablesDB } from 'node-appwrite';

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickProfileContext(row) {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    college: row.college,
    primary_intent: row.primary_intent,
    goals: row.goals || [],
    desired_connections: row.desired_connections || [],
    startup_connections: row.startup_connections || [],
    career_field: row.career_field,
    career_subfield: row.career_subfield,
    study_subject: row.study_subject,
    year_of_study: row.year_of_study,
    networking_style: row.networking_style,
    intellectual_identity: row.intellectual_identity,
    building_description: row.building_description,
    has_cv: Boolean(row.cv_file_id),
    is_onboarding_complete: Boolean(row.is_onboarding_complete),
  };
}

export default async ({ req, res, error }) => {
  const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;

  const appwrite = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(process.env.APPWRITE_API_KEY);

  const tables = new TablesDB(appwrite);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = normalizeString(body.action || 'get_bio_context');

    if (action !== 'get_bio_context') {
      return res.json({ error: `Unknown action: ${action}` }, 400);
    }

    const userId = normalizeString(body.user_id || body.userId);
    if (!userId) {
      return res.json({ error: 'user_id is required' }, 400);
    }

    const found = await tables.listRows({
      databaseId: DB_ID,
      tableId: PROFILES_TABLE,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
    });

    const profile = found.rows?.[0];
    if (!profile) {
      return res.json({ error: 'Profile not found' }, 404);
    }

    return res.json({
      profile: pickProfileContext(profile),
      metadata: {
        source_table: PROFILES_TABLE,
      },
    });
  } catch (err) {
    error(`biosContext error: ${err.message}`);
    if (err.stack) error(err.stack);
    return res.json({ error: err.message }, 500);
  }
};
