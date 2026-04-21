import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Functions, ID, TablesDB, Users } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
  throw new Error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY in .env');
}

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(SCRIPT_DIR, 'ui_smoke_fixture.json');

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const users = new Users(client);
const tables = new TablesDB(client);
const functions = new Functions(client);

const timestamp = Date.now();
const password = 'Sup3rCharged!123';

function firstName(fullName) {
  return fullName.split(' ')[0] || 'User';
}

function lastName(fullName) {
  const parts = fullName.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : 'Member';
}

async function executeFunction(functionId, payload) {
  const execution = await functions.createExecution(functionId, JSON.stringify(payload), false);
  const responseStatusCode = execution.responseStatusCode || 0;
  const responseBody = execution.responseBody ? JSON.parse(execution.responseBody) : {};

  if (responseStatusCode >= 400 || responseBody?.error) {
    throw new Error(responseBody?.error || execution.errors || `Execution failed with status ${responseStatusCode}`);
  }

  return responseBody;
}

async function createActor(label, fullName) {
  const email = `e2e.${label}.${timestamp}@example.com`;

  const user = await users.create({
    userId: ID.unique(),
    email,
    password,
    name: fullName,
  });

  const profile = await tables.createRow({
    databaseId: DB_ID,
    tableId: 'profiles',
    rowId: ID.unique(),
    data: {
      user_id: user.$id,
      full_name: fullName,
      first_name: firstName(fullName),
      last_name: lastName(fullName),
      primary_intent: 'Professional Networking',
      college: 'St Johns',
      study_subject: 'Computer Science',
      career_field: 'Tech & AI',
      is_onboarding_complete: true,
      is_indexed: true,
    },
  });

  return {
    label,
    name: fullName,
    email,
    user_id: user.$id,
    profile_id: profile.$id,
  };
}

async function main() {
  const fixtureRaw = await fs.readFile(FIXTURE_PATH, 'utf8');
  const fixture = JSON.parse(fixtureRaw);

  const responder = fixture?.actors?.responderB;
  if (!responder?.profile_id || !responder?.user_id) {
    throw new Error('Fixture missing actors.responderB.profile_id or actors.responderB.user_id');
  }

  const requesterLabel = `initiatorExtra${timestamp}`;
  const requesterName = `E2E Initiator Extra ${timestamp}`;
  const requester = await createActor(requesterLabel, requesterName);

  const request = await executeFunction('connectionGateway', {
    action: 'initiate_request',
    current_user_id: requester.user_id,
    target_profile_id: responder.profile_id,
    opening_message: `Hi from ${requester.name} - extra pending request ${timestamp}`,
  });

  const pendingForResponder = await executeFunction('connectionGateway', {
    action: 'list_pending_to_me',
    current_user_id: responder.user_id,
    limit: 30,
  });

  fixture.updated_at = new Date().toISOString();
  fixture.password = fixture.password || password;
  fixture.actors = fixture.actors || {};
  fixture.actors[requesterLabel] = requester;
  fixture.created_connections = fixture.created_connections || {};
  fixture.created_connections.latest_extra_target = request.connection_id;
  fixture.pending_total_for_responder = pendingForResponder.total;

  await fs.writeFile(FIXTURE_PATH, JSON.stringify(fixture, null, 2), 'utf8');

  const out = {
    responder_email: responder.email,
    new_requester: requester,
    new_connection_id: request.connection_id,
    pending_total_for_responder: pendingForResponder.total,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('ADD_UI_SMOKE_REQUEST_FAILED');
  console.error(err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
