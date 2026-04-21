import { Client, ID, Query, TablesDB } from 'node-appwrite';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  tracesSampleRate: process.env.SENTRY_DSN ? 1.0 : 0,
});

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const CONVERSATIONS_TABLE = process.env.APPWRITE_CONVERSATIONS_TABLE || 'conversations';
const CONVERSATION_MEMBERS_TABLE = process.env.APPWRITE_CONVERSATION_MEMBERS_TABLE || 'conversation_members';
const MESSAGES_TABLE = process.env.APPWRITE_MESSAGES_TABLE || 'messages';
const CONNECTIONS_TABLE = process.env.APPWRITE_CONNECTIONS_TABLE || 'connections';
const REL_EVENTS_TABLE = process.env.APPWRITE_REL_EVENTS_TABLE || 'relationship_events';
const VOLTZ_LEDGER_TABLE = process.env.APPWRITE_VOLTZ_LEDGER_TABLE || 'voltz_ledger';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const VOLTZ_POINTS = {
  message_sent: 2,
  milestone_5_exchanges: 10,
  milestone_10_exchanges: 15,
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function clampLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function clampOffset(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function relationId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$id) return value.$id;
  return null;
}

function resolveCurrentUserId(req, body) {
  return normalizeString(
    req.headers['x-appwrite-user-id']
    || req.headers['x-appwrite-userid']
    || body.current_user_id
    || body.user_id
    || body.userId
  );
}

function toAction(input) {
  return normalizeString(input).toLowerCase();
}

function createTables() {
  const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || process.env.APPWRITE_API_KEY;

  if (!projectId) {
    throw new HttpError(500, 'APPWRITE_FUNCTION_PROJECT_ID is required');
  }

  if (!apiKey) {
    throw new HttpError(500, 'Function API key is missing');
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return new TablesDB(client);
}

async function listOneRow(tables, tableId, queries) {
  const out = await tables.listRows({
    databaseId: DB_ID,
    tableId,
    queries: [...queries, Query.limit(1)],
  });
  return out.rows?.[0] || null;
}

async function getRowOrNull(tables, tableId, rowId) {
  if (!rowId) return null;
  try {
    return await tables.getRow({
      databaseId: DB_ID,
      tableId,
      rowId,
    });
  } catch {
    return null;
  }
}

async function getProfileByUserId(tables, userId) {
  return listOneRow(tables, PROFILES_TABLE, [Query.equal('user_id', userId)]);
}

async function requireCurrentProfile(tables, req, body) {
  const userId = resolveCurrentUserId(req, body);
  if (!userId) throw new HttpError(401, 'Unable to resolve current user id');

  const profile = await getProfileByUserId(tables, userId);
  if (!profile) throw new HttpError(404, 'Current profile not found');

  return profile;
}

async function requireMembership(tables, conversationId, profileId) {
  const membership = await listOneRow(tables, CONVERSATION_MEMBERS_TABLE, [
    Query.equal('conversation', conversationId),
    Query.equal('profile', profileId),
  ]);

  if (!membership) {
    throw new HttpError(403, 'User is not a member of this conversation');
  }

  return membership;
}

async function getConnectionByConversation(tables, conversationId) {
  return listOneRow(tables, CONNECTIONS_TABLE, [
    Query.equal('conversation_row_id', conversationId),
  ]);
}

async function createRelationshipEvent(tables, { connectionId, actorId, eventType, details = '', voltz = 0, occurredAt = new Date().toISOString() }) {
  if (!connectionId) return null;

  return tables.createRow({
    databaseId: DB_ID,
    tableId: REL_EVENTS_TABLE,
    rowId: ID.unique(),
    data: {
      connection: connectionId,
      connection_row_id: connectionId,
      actor: actorId || null,
      actor_profile_id: actorId || null,
      event_type: eventType,
      details: details || null,
      voltz_awarded: voltz,
      occurred_at: occurredAt,
    },
  });
}

async function createVoltzEntry(tables, { profileId, connectionId, relationshipEventId, eventType, amount, reason, awardedAt = new Date().toISOString() }) {
  if (!profileId || !amount) return null;

  return tables.createRow({
    databaseId: DB_ID,
    tableId: VOLTZ_LEDGER_TABLE,
    rowId: ID.unique(),
    data: {
      profile: profileId,
      profile_row_id: profileId,
      connection: connectionId || null,
      connection_row_id: connectionId || null,
      relationship_event: relationshipEventId || null,
      relationship_event_row_id: relationshipEventId || null,
      event_type: eventType,
      amount,
      reason,
      awarded_at: awardedAt,
    },
  });
}

async function unreadCount(tables, conversationId, profileId, lastReadAt = null) {
  const baseQueries = [
    Query.equal('conversation', conversationId),
    Query.notEqual('sender', profileId),
    Query.notEqual('delivery_status', 'read'),
    Query.limit(200),
  ];
  const queries = lastReadAt ? [...baseQueries, Query.greaterThan('sent_at', lastReadAt)] : baseQueries;

  try {
    const out = await tables.listRows({
      databaseId: DB_ID,
      tableId: MESSAGES_TABLE,
      queries,
    });
    return out.total ?? out.rows.length;
  } catch {
    const fallback = await tables.listRows({
      databaseId: DB_ID,
      tableId: MESSAGES_TABLE,
      queries: [Query.equal('conversation', conversationId), Query.limit(200)],
    });

    const filtered = fallback.rows.filter((row) => {
      const senderId = relationId(row.sender);
      if (senderId === profileId) return false;
      if (row.delivery_status === 'read') return false;
      if (!lastReadAt) return true;
      return new Date(row.sent_at).getTime() > new Date(lastReadAt).getTime();
    });

    return filtered.length;
  }
}

async function maybeAwardMilestone(tables, connection, profileId, messageTotal, now) {
  if (!connection || !profileId) {
    return { milestone: null, amount: 0 };
  }

  let milestoneEventType = null;
  let milestoneReason = null;

  if (messageTotal === 5) {
    milestoneEventType = 'milestone_5_exchanges';
    milestoneReason = 'Reached 5 message exchanges';
  } else if (messageTotal === 10) {
    milestoneEventType = 'milestone_10_exchanges';
    milestoneReason = 'Reached 10 message exchanges';
  }

  if (!milestoneEventType) {
    return { milestone: null, amount: 0 };
  }

  const amount = VOLTZ_POINTS[milestoneEventType];
  const event = await createRelationshipEvent(tables, {
    connectionId: connection.$id,
    actorId: profileId,
    eventType: milestoneEventType,
    details: milestoneReason,
    voltz: amount,
    occurredAt: now,
  });

  await createVoltzEntry(tables, {
    profileId,
    connectionId: connection.$id,
    relationshipEventId: event?.$id || null,
    eventType: milestoneEventType,
    amount,
    reason: milestoneReason,
    awardedAt: now,
  });

  return { milestone: milestoneEventType, amount };
}

async function actionSendMessage({ tables, body, currentProfile }) {
  const conversationId = normalizeString(body.conversation_id || body.conversationId);
  const rawBody = normalizeString(body.body || body.text || body.message);
  const replyToMessageId = normalizeString(body.reply_to_message_id || body.replyToMessageId) || null;

  if (!conversationId) throw new HttpError(400, 'conversation_id is required');
  if (!rawBody) throw new HttpError(400, 'body is required');

  const messageBody = rawBody.length > 5000 ? rawBody.slice(0, 5000) : rawBody;
  const now = new Date().toISOString();

  await requireMembership(tables, conversationId, currentProfile.$id);

  const existingLatest = await listOneRow(tables, MESSAGES_TABLE, [
    Query.equal('conversation', conversationId),
    Query.orderDesc('sent_at'),
  ]);

  const message = await tables.createRow({
    databaseId: DB_ID,
    tableId: MESSAGES_TABLE,
    rowId: ID.unique(),
    data: {
      conversation: conversationId,
      sender: currentProfile.$id,
      body: messageBody,
      message_type: 'text',
      delivery_status: 'sent',
      is_edited: false,
      is_deleted: false,
      sent_at: now,
      reply_to_message_id: replyToMessageId,
    },
  });

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: CONVERSATIONS_TABLE,
    rowId: conversationId,
    data: {
      last_message_at: now,
    },
  });

  const selfMember = await listOneRow(tables, CONVERSATION_MEMBERS_TABLE, [
    Query.equal('conversation', conversationId),
    Query.equal('profile', currentProfile.$id),
  ]);

  if (selfMember) {
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: CONVERSATION_MEMBERS_TABLE,
      rowId: selfMember.$id,
      data: {
        last_read_at: now,
      },
    });
  }

  const connection = await getConnectionByConversation(tables, conversationId);
  let event = null;

  if (connection) {
    event = await createRelationshipEvent(tables, {
      connectionId: connection.$id,
      actorId: currentProfile.$id,
      eventType: 'message_sent',
      details: existingLatest && relationId(existingLatest.sender) !== currentProfile.$id
        ? 'Reply sent'
        : 'Message sent',
      voltz: VOLTZ_POINTS.message_sent,
      occurredAt: now,
    });

    await createVoltzEntry(tables, {
      profileId: currentProfile.$id,
      connectionId: connection.$id,
      relationshipEventId: event?.$id || null,
      eventType: 'message_sent',
      amount: VOLTZ_POINTS.message_sent,
      reason: 'Message sent',
      awardedAt: now,
    });

    await tables.updateRow({
      databaseId: DB_ID,
      tableId: CONNECTIONS_TABLE,
      rowId: connection.$id,
      data: {
        last_activity_at: now,
      },
    });
  }

  const countOut = await tables.listRows({
    databaseId: DB_ID,
    tableId: MESSAGES_TABLE,
    queries: [Query.equal('conversation', conversationId), Query.limit(1)],
  });

  const milestone = await maybeAwardMilestone(
    tables,
    connection,
    currentProfile.$id,
    countOut.total ?? countOut.rows.length,
    now
  );

  return {
    success: true,
    message: {
      id: message.$id,
      conversation_id: conversationId,
      sender_profile_id: currentProfile.$id,
      body: messageBody,
      delivery_status: 'sent',
      sent_at: now,
    },
    voltz_earned: VOLTZ_POINTS.message_sent + milestone.amount,
    milestone: milestone.milestone,
  };
}

async function actionListMessages({ tables, body, currentProfile }) {
  const conversationId = normalizeString(body.conversation_id || body.conversationId);
  if (!conversationId) throw new HttpError(400, 'conversation_id is required');

  const limit = clampLimit(body.limit);
  const offset = clampOffset(body.offset);

  await requireMembership(tables, conversationId, currentProfile.$id);

  const queries = [
    Query.equal('conversation', conversationId),
    Query.orderAsc('sent_at'),
    Query.limit(limit),
  ];
  if (offset > 0) queries.push(Query.offset(offset));

  const out = await tables.listRows({
    databaseId: DB_ID,
    tableId: MESSAGES_TABLE,
    queries,
  });

  const senderIds = Array.from(new Set(out.rows.map((row) => relationId(row.sender)).filter(Boolean)));
  const profileMap = new Map();

  for (const senderId of senderIds) {
    const profile = await getRowOrNull(tables, PROFILES_TABLE, senderId);
    if (profile) profileMap.set(senderId, profile);
  }

  const mapped = out.rows.map((row) => {
    const senderId = relationId(row.sender);
    const senderProfile = profileMap.get(senderId);

    return {
      id: row.$id,
      conversation_id: conversationId,
      sender_profile_id: senderId,
      sender_name: senderProfile?.full_name || null,
      sender_initials: senderProfile?.full_name
        ? senderProfile.full_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
        : null,
      body: row.body,
      message_type: row.message_type,
      delivery_status: row.delivery_status,
      sent_at: row.sent_at,
      direction: senderId === currentProfile.$id ? 'out' : 'in',
    };
  });

  return {
    success: true,
    messages: mapped,
    total: out.total ?? mapped.length,
  };
}

async function actionMarkDelivered({ tables, body, currentProfile }) {
  const messageId = normalizeString(body.message_id || body.messageId);
  if (!messageId) throw new HttpError(400, 'message_id is required');

  const message = await getRowOrNull(tables, MESSAGES_TABLE, messageId);
  if (!message) throw new HttpError(404, 'Message not found');

  const conversationId = relationId(message.conversation);
  if (!conversationId) throw new HttpError(400, 'Message is not attached to a conversation');

  await requireMembership(tables, conversationId, currentProfile.$id);

  const senderId = relationId(message.sender);
  if (senderId === currentProfile.$id) {
    return {
      success: true,
      status: message.delivery_status,
      message_id: message.$id,
    };
  }

  if (message.delivery_status === 'sent') {
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: MESSAGES_TABLE,
      rowId: message.$id,
      data: {
        delivery_status: 'delivered',
      },
    });
  }

  return {
    success: true,
    status: message.delivery_status === 'sent' ? 'delivered' : message.delivery_status,
    message_id: message.$id,
  };
}

async function actionMarkRead({ tables, body, currentProfile }) {
  const messageId = normalizeString(body.message_id || body.messageId);
  const conversationIdFromBody = normalizeString(body.conversation_id || body.conversationId);

  if (!messageId && !conversationIdFromBody) {
    throw new HttpError(400, 'message_id or conversation_id is required');
  }

  let conversationId = conversationIdFromBody;
  let targetMessage = null;

  if (messageId) {
    targetMessage = await getRowOrNull(tables, MESSAGES_TABLE, messageId);
    if (!targetMessage) throw new HttpError(404, 'Message not found');
    conversationId = relationId(targetMessage.conversation);
  }

  if (!conversationId) throw new HttpError(400, 'Unable to resolve conversation');

  const membership = await requireMembership(tables, conversationId, currentProfile.$id);
  const now = new Date().toISOString();

  if (targetMessage) {
    const senderId = relationId(targetMessage.sender);
    if (senderId !== currentProfile.$id && targetMessage.delivery_status !== 'read') {
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: MESSAGES_TABLE,
        rowId: targetMessage.$id,
        data: {
          delivery_status: 'read',
        },
      });
    }
  } else {
    const unread = await tables.listRows({
      databaseId: DB_ID,
      tableId: MESSAGES_TABLE,
      queries: [
        Query.equal('conversation', conversationId),
        Query.notEqual('sender', currentProfile.$id),
        Query.notEqual('delivery_status', 'read'),
        Query.limit(100),
      ],
    });

    for (const row of unread.rows) {
      // eslint-disable-next-line no-await-in-loop
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: MESSAGES_TABLE,
        rowId: row.$id,
        data: {
          delivery_status: 'read',
        },
      });
    }
  }

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: CONVERSATION_MEMBERS_TABLE,
    rowId: membership.$id,
    data: {
      last_read_at: now,
    },
  });

  const connection = await getConnectionByConversation(tables, conversationId);
  if (connection) {
    await createRelationshipEvent(tables, {
      connectionId: connection.$id,
      actorId: currentProfile.$id,
      eventType: 'message_read',
      details: 'Messages marked as read.',
      occurredAt: now,
    });
  }

  const unread = await unreadCount(tables, conversationId, currentProfile.$id, now);

  return {
    success: true,
    conversation_id: conversationId,
    unread_count: unread,
    last_read_at: now,
  };
}

async function actionListUnreadCounts({ tables, body, currentProfile }) {
  const limit = clampLimit(body.limit || 100);

  const memberships = await tables.listRows({
    databaseId: DB_ID,
    tableId: CONVERSATION_MEMBERS_TABLE,
    queries: [
      Query.equal('profile', currentProfile.$id),
      Query.limit(limit),
    ],
  });

  const rows = [];
  for (const member of memberships.rows) {
    const conversationId = relationId(member.conversation);
    if (!conversationId) continue;

    const unread = await unreadCount(
      tables,
      conversationId,
      currentProfile.$id,
      member.last_read_at || null
    );

    rows.push({
      conversation_id: conversationId,
      unread_count: unread,
      last_read_at: member.last_read_at || null,
    });
  }

  return {
    success: true,
    conversations: rows,
  };
}

export default async ({ req, res, log, error }) => {
  const tables = createTables();

  try {
    const body = parseBody(req);
    const action = toAction(body.action);

    if (!action) {
      throw new HttpError(400, 'action is required');
    }

    const currentProfile = await requireCurrentProfile(tables, req, body);

    let payload;
    switch (action) {
      case 'send_message':
        payload = await actionSendMessage({ tables, body, currentProfile });
        break;
      case 'list_messages':
        payload = await actionListMessages({ tables, body, currentProfile });
        break;
      case 'mark_delivered':
        payload = await actionMarkDelivered({ tables, body, currentProfile });
        break;
      case 'mark_read':
      case 'mark_conversation_read':
        payload = await actionMarkRead({ tables, body, currentProfile });
        break;
      case 'list_unread_counts':
        payload = await actionListUnreadCounts({ tables, body, currentProfile });
        break;
      default:
        throw new HttpError(400, `Unknown action: ${action}`);
    }

    return res.json(payload);
  } catch (err) {
    if (err.status && err.status < 500) {
      if (log) log(`messageGateway ${err.status}: ${err.message}`);
      return res.json({ error: err.message }, err.status);
    }

    if (error) {
      error(`messageGateway fatal: ${err.message}`);
      if (err.stack) error(err.stack);
    }
    Sentry.captureException(err);

    return res.json({ error: err.message || 'Internal error' }, err.status || 500);
  }
};
