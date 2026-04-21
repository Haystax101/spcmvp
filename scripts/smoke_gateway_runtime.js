import 'dotenv/config';
import { Client, Functions, Query, TablesDB } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1';
const apiKey = process.env.APPWRITE_API_KEY;

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const CONNECTIONS_TABLE = process.env.APPWRITE_CONNECTIONS_TABLE || 'connections';
const CONNECTION_GATEWAY_FUNCTION_ID = process.env.CONNECTION_GATEWAY_FUNCTION_ID || 'connectionGateway';
const MESSAGE_GATEWAY_FUNCTION_ID = process.env.MESSAGE_GATEWAY_FUNCTION_ID || 'messageGateway';

if (!apiKey) {
  console.error('APPWRITE_API_KEY is required in .env');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tables = new TablesDB(client);
const functions = new Functions(client);

function relationId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$id) return value.$id;
  return null;
}

function pairKey(a, b) {
  return [a, b].sort().join(':');
}

function parseExecutionBody(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return { __raw: value };
  }
}

async function execute(functionId, payload) {
  const execution = await functions.createExecution(functionId, JSON.stringify(payload), false);
  const body = parseExecutionBody(execution.responseBody || '{}');
  if (body?.error) {
    throw new Error(body.error);
  }
  return body;
}

function pickUsersAndConnection(profiles, connections) {
  const profileById = new Map(profiles.map((p) => [p.$id, p]));
  const pairMap = new Map();

  for (const row of connections) {
    const initiatorId = row.initiator_profile_id || relationId(row.initiator);
    const responderId = row.responder_profile_id || relationId(row.responder);
    if (!initiatorId || !responderId) continue;
    pairMap.set(pairKey(initiatorId, responderId), row);
  }

  // Prefer a clean pair with no prior relationship so the full lifecycle can be tested.
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i];
      const b = profiles[j];
      if (!pairMap.has(pairKey(a.$id, b.$id))) {
        return {
          mode: 'new_pair',
          initiator: a,
          responder: b,
          existing: null,
        };
      }
    }
  }

  const pending = connections.find((row) => row.status === 'pending' && profileById.has(row.initiator_profile_id) && profileById.has(row.responder_profile_id));
  if (pending) {
    return {
      mode: 'pending_pair',
      initiator: profileById.get(pending.initiator_profile_id),
      responder: profileById.get(pending.responder_profile_id),
      existing: pending,
    };
  }

  const accepted = connections.find((row) => row.status === 'accepted' && profileById.has(row.initiator_profile_id) && profileById.has(row.responder_profile_id));
  if (accepted) {
    return {
      mode: 'accepted_pair',
      initiator: profileById.get(accepted.initiator_profile_id),
      responder: profileById.get(accepted.responder_profile_id),
      existing: accepted,
    };
  }

  return {
    mode: 'fallback_pair',
    initiator: profiles[0],
    responder: profiles[1],
    existing: null,
  };
}

async function main() {
  const profilesOut = await tables.listRows({
    databaseId: DB_ID,
    tableId: PROFILES_TABLE,
    queries: [Query.limit(100)],
  });
  const profiles = (profilesOut.rows || []).filter((row) => row.$id && row.user_id);

  if (profiles.length < 2) {
    throw new Error('Need at least two profiles with user_id for smoke test');
  }

  const connectionsOut = await tables.listRows({
    databaseId: DB_ID,
    tableId: CONNECTIONS_TABLE,
    queries: [Query.limit(200)],
  });
  const allConnections = connectionsOut.rows || [];

  const selected = pickUsersAndConnection(profiles, allConnections);
  const { initiator, responder, mode, existing } = selected;

  const report = {
    selected_mode: mode,
    users: {
      initiator: {
        profile_id: initiator.$id,
        user_id: initiator.user_id,
        name: initiator.full_name,
      },
      responder: {
        profile_id: responder.$id,
        user_id: responder.user_id,
        name: responder.full_name,
      },
    },
    steps: {},
  };

  report.steps.list_active_before = await execute(CONNECTION_GATEWAY_FUNCTION_ID, {
    action: 'list_active',
    current_user_id: initiator.user_id,
    limit: 15,
  });

  let connectionId = existing?.$id || null;
  let conversationId = existing?.conversation_row_id || relationId(existing?.conversation) || null;

  if (!connectionId) {
    report.steps.initiate_request = await execute(CONNECTION_GATEWAY_FUNCTION_ID, {
      action: 'initiate_request',
      current_user_id: initiator.user_id,
      target_profile_id: responder.$id,
      opening_message: `Smoke-test hello from ${initiator.full_name} at ${new Date().toISOString()}`,
    });

    connectionId = report.steps.initiate_request.connection_id || null;

    report.steps.list_pending_to_me = await execute(CONNECTION_GATEWAY_FUNCTION_ID, {
      action: 'list_pending_to_me',
      current_user_id: responder.user_id,
      limit: 20,
    });
  }

  if (connectionId && !conversationId) {
    report.steps.accept_connection = await execute(CONNECTION_GATEWAY_FUNCTION_ID, {
      action: 'accept_connection',
      current_user_id: responder.user_id,
      connection_id: connectionId,
    });

    conversationId = report.steps.accept_connection.conversation_id || null;
  }

  if (connectionId && !conversationId) {
    report.steps.get_connection = await execute(CONNECTION_GATEWAY_FUNCTION_ID, {
      action: 'get_connection',
      current_user_id: initiator.user_id,
      connection_id: connectionId,
    });
    conversationId = report.steps.get_connection?.connection?.conversation_id || null;
  }

  if (!conversationId) {
    throw new Error('No conversation_id available after connection setup');
  }

  report.steps.send_message = await execute(MESSAGE_GATEWAY_FUNCTION_ID, {
    action: 'send_message',
    current_user_id: initiator.user_id,
    conversation_id: conversationId,
    body: `Smoke-test message at ${new Date().toISOString()}`,
  });

  const messagesOut = await execute(MESSAGE_GATEWAY_FUNCTION_ID, {
    action: 'list_messages',
    current_user_id: responder.user_id,
    conversation_id: conversationId,
    limit: 25,
  });
  report.steps.list_messages = {
    total: messagesOut.total,
    latest: (messagesOut.messages || []).slice(-1)[0] || null,
  };

  report.steps.mark_conversation_read = await execute(MESSAGE_GATEWAY_FUNCTION_ID, {
    action: 'mark_conversation_read',
    current_user_id: responder.user_id,
    conversation_id: conversationId,
  });

  report.steps.list_unread_counts_initiator = await execute(MESSAGE_GATEWAY_FUNCTION_ID, {
    action: 'list_unread_counts',
    current_user_id: initiator.user_id,
    limit: 50,
  });

  report.steps.list_unread_counts_responder = await execute(MESSAGE_GATEWAY_FUNCTION_ID, {
    action: 'list_unread_counts',
    current_user_id: responder.user_id,
    limit: 50,
  });

  report.ids = {
    connection_id: connectionId,
    conversation_id: conversationId,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('SMOKE_TEST_FAILED');
  console.error(err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
