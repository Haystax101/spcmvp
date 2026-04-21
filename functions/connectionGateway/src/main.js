import { Client, ID, Query, TablesDB } from 'node-appwrite';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  tracesSampleRate: process.env.SENTRY_DSN ? 1.0 : 0,
});

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const MATCHES_TABLE = process.env.APPWRITE_MATCHES_TABLE || 'matches';
const CONVERSATIONS_TABLE = process.env.APPWRITE_CONVERSATIONS_TABLE || 'conversations';
const CONVERSATION_MEMBERS_TABLE = process.env.APPWRITE_CONVERSATION_MEMBERS_TABLE || 'conversation_members';
const MESSAGES_TABLE = process.env.APPWRITE_MESSAGES_TABLE || 'messages';
const CONNECTIONS_TABLE = process.env.APPWRITE_CONNECTIONS_TABLE || 'connections';
const REL_EVENTS_TABLE = process.env.APPWRITE_REL_EVENTS_TABLE || 'relationship_events';
const VOLTZ_LEDGER_TABLE = process.env.APPWRITE_VOLTZ_LEDGER_TABLE || 'voltz_ledger';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const DECLINE_UNDO_MS = Number.parseInt(process.env.CONNECTION_DECLINE_UNDO_MS || '3000', 10);

const VOLTZ_POINTS = {
  message_sent: 2,
  connection_accepted: 5,
};

const AVATAR_PALETTE = ['#7B5CF0', '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B6DD3', '#2A9F7F', '#C96B44', '#5B8CF5'];
const STAGE_FLOW = ['accepted', 'first_reply', 'call_booked', 'coffee_done', 'introduction_made'];
const STAGE_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  first_reply: 'First reply',
  call_booked: 'Call booked',
  coffee_done: 'Coffee done',
  introduction_made: 'Introduction made',
  declined: 'Declined',
  blocked: 'Blocked',
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

function truncate(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function buildPairKey(profileAId, profileBId) {
  return [profileAId, profileBId].sort().join(':');
}

function initialsFromName(name) {
  const trimmed = normalizeString(name);
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || parts[0]?.[1] || '';
  return (first + second).toUpperCase() || '??';
}

function colorFromName(name) {
  const key = normalizeString(name) || 'unknown';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function profileRole(profile) {
  const subject = normalizeString(profile?.study_subject);
  const field = normalizeString(profile?.career_field);
  const college = normalizeString(profile?.college);

  if (field && subject) return `${field} · ${subject}`;
  if (field) return field;
  if (subject) return subject;
  if (college) return `Student · ${college}`;
  return 'Oxford member';
}

function relativeTime(iso) {
  if (!iso) return 'Now';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'Now';

  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 14) return '1w';
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function scoreTier(score) {
  if (score >= 85) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
}

function dayDiffFromNow(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function clampScore(value, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function toUniqueList(value) {
  if (!value) return [];

  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const seen = new Set();
  const out = [];
  for (const item of source) {
    const normalized = normalizeString(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function overlapValues(left, right) {
  const rightMap = new Map(right.map((item) => [item.toLowerCase(), item]));
  const out = [];
  for (const item of left) {
    const key = item.toLowerCase();
    if (rightMap.has(key)) out.push(rightMap.get(key));
  }
  return toUniqueList(out);
}

function listSummary(values, max = 2) {
  const safe = toUniqueList(values);
  if (safe.length === 0) return '';
  if (safe.length <= max) return safe.join(', ');
  return `${safe.slice(0, max).join(', ')} +${safe.length - max} more`;
}

function parseCompatibilitySnapshot(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.chips)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function stageLabel(stageKey) {
  return STAGE_LABELS[stageKey] || 'Unknown';
}

function stageCompletedSteps(stageKey) {
  const idx = STAGE_FLOW.indexOf(stageKey);
  if (idx >= 0) return idx + 1;
  return 0;
}

function buildStageProgress(stageKey) {
  const completed = stageCompletedSteps(stageKey);
  return {
    current_stage: stageKey || 'unknown',
    current_label: stageLabel(stageKey),
    completed_steps: completed,
    total_steps: STAGE_FLOW.length,
    steps: STAGE_FLOW.map((key, index) => ({
      key,
      label: stageLabel(key),
      done: index < completed,
    })),
    logic_source: 'deterministic_events',
    llm_stage_autoadvance: 'NOT_YET',
  };
}

function parseIsoMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function toIso(value, fallbackIso) {
  const ms = parseIsoMs(value);
  if (ms === null) return fallbackIso;
  return new Date(ms).toISOString();
}

function eventStrengthDelta(eventType) {
  if (eventType === 'outreach_sent') return 2;
  if (eventType === 'connection_accepted') return 6;
  if (eventType === 'first_reply') return 10;
  if (eventType === 'call_booked') return 14;
  if (eventType === 'coffee_done') return 16;
  if (eventType === 'introduction_made') return 18;
  if (eventType === 'declined') return -8;
  if (eventType === 'undone') return 5;
  if (eventType === 'blocked') return -20;
  return 3;
}

function messageStrengthDelta(messageCount) {
  if (messageCount <= 1) return 24;
  if (messageCount <= 4) return 8;
  if (messageCount <= 10) return 4;
  return 2;
}

function downsampleSeries(points, maxPoints = 24) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];

  const out = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round(i * step);
    out.push(points[idx]);
  }
  return out;
}

function buildRelationshipStrengthSeries({ connection, events, messages }) {
  const fallbackIso = new Date().toISOString();
  const baselineAt = toIso(
    connection?.initiated_at
      || connection?.accepted_at
      || connection?.last_activity_at,
    fallbackIso
  );

  let score = 0;
  const points = [{ at: baselineAt, score, source: 'started' }];

  const timeline = [];

  if (Array.isArray(events)) {
    for (const event of events) {
      const eventType = normalizeString(event?.event_type);
      const occurredAt = event?.occurred_at;
      if (!eventType || !occurredAt) continue;
      if (eventType === 'message_sent' || eventType === 'message_read') continue;
      if (eventType === 'milestone_5_exchanges' || eventType === 'milestone_10_exchanges') continue;
      const atMs = parseIsoMs(occurredAt);
      if (atMs === null) continue;
      timeline.push({ at: new Date(atMs).toISOString(), atMs, type: 'event', eventType });
    }
  }

  if (Array.isArray(messages)) {
    for (const row of messages) {
      const atMs = parseIsoMs(row?.sent_at);
      if (atMs === null) continue;
      timeline.push({ at: new Date(atMs).toISOString(), atMs, type: 'message' });
    }
  }

  timeline.sort((a, b) => a.atMs - b.atMs);

  let messageCount = 0;
  for (const item of timeline) {
    if (item.type === 'message') {
      messageCount += 1;
      score = clampScore(score + messageStrengthDelta(messageCount));
      points.push({ at: item.at, score, source: messageCount === 1 ? 'first_message' : 'message' });
      continue;
    }

    const delta = eventStrengthDelta(item.eventType);
    score = clampScore(score + delta);
    points.push({ at: item.at, score, source: item.eventType });
  }

  const deduped = [];
  for (const point of points) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.at === point.at) {
      if (point.score >= prev.score) {
        deduped[deduped.length - 1] = point;
      }
    } else {
      deduped.push(point);
    }
  }

  if (deduped.length === 1 && connection?.last_activity_at) {
    deduped.push({
      at: toIso(connection.last_activity_at, deduped[0].at),
      score: deduped[0].score,
      source: 'last_activity',
    });
  }

  return downsampleSeries(deduped, 24);
}

function buildCompatibilitySnapshot({ profileA, profileB, baseScore, generatedAt }) {
  const aCollege = normalizeString(profileA?.college);
  const bCollege = normalizeString(profileB?.college);
  const aSubject = normalizeString(profileA?.study_subject);
  const bSubject = normalizeString(profileB?.study_subject);
  const aCareer = normalizeString(profileA?.career_field);
  const bCareer = normalizeString(profileB?.career_field);

  const sameCollege = Boolean(aCollege) && aCollege.toLowerCase() === bCollege.toLowerCase();
  const sameSubject = Boolean(aSubject) && aSubject.toLowerCase() === bSubject.toLowerCase();
  const sameCareer = Boolean(aCareer) && aCareer.toLowerCase() === bCareer.toLowerCase();

  const goalsOverlap = overlapValues(toUniqueList(profileA?.goals), toUniqueList(profileB?.goals));
  const desiredOverlap = overlapValues(toUniqueList(profileA?.desired_connections), toUniqueList(profileB?.desired_connections));
  const startupOverlap = overlapValues(toUniqueList(profileA?.startup_connections), toUniqueList(profileB?.startup_connections));
  const circlesOverlap = overlapValues(toUniqueList(profileA?.social_circles), toUniqueList(profileB?.social_circles));
  const datingOverlap = overlapValues(toUniqueList(profileA?.dating_hobbies), toUniqueList(profileB?.dating_hobbies));

  const background = clampScore(50 + (sameCollege ? 24 : 0) + (sameSubject ? 14 : 0) + (sameCareer ? 12 : 0));
  const goals = clampScore(46 + (goalsOverlap.length * 15) + (desiredOverlap.length * 9) + (startupOverlap.length * 8));
  const network = clampScore(50 + (circlesOverlap.length * 12) + (datingOverlap.length * 7));
  const stage = clampScore((baseScore * 0.6) + (goals * 0.2) + (network * 0.2));
  const score = clampScore((baseScore * 0.7) + (background * 0.1) + (goals * 0.1) + (network * 0.1));

  const chips = [];
  if (sameCollege) {
    chips.push({
      key: 'college',
      label: `Both ${aCollege}`,
      tooltip: `You both list ${aCollege}. Referencing shared college context can make the opener feel natural.`,
    });
  }
  if (sameCareer) {
    chips.push({
      key: 'career',
      label: `${aCareer} focus`,
      tooltip: `Both profiles map to ${aCareer}. Keep examples practical and domain-specific.`,
    });
  }
  if (sameSubject) {
    chips.push({
      key: 'subject',
      label: `Shared subject: ${aSubject}`,
      tooltip: `A common academic thread in ${aSubject} can anchor the conversation quickly.`,
    });
  }
  if (goalsOverlap.length > 0) {
    chips.push({
      key: 'goals',
      label: `Shared goals`,
      tooltip: `Goal overlap: ${listSummary(goalsOverlap, 2)}. Position next steps around this shared direction.`,
    });
  }
  if (circlesOverlap.length > 0) {
    chips.push({
      key: 'circles',
      label: `${circlesOverlap.length} shared circles`,
      tooltip: `Social overlap: ${listSummary(circlesOverlap, 3)}. Mentioning one mutual context can warm the thread.`,
    });
  }
  if (desiredOverlap.length > 0) {
    chips.push({
      key: 'connection_goals',
      label: `Connection goals align`,
      tooltip: `Both profiles prioritize: ${listSummary(desiredOverlap, 2)}. This makes intent clearer early on.`,
    });
  }
  if (startupOverlap.length > 0) {
    chips.push({
      key: 'startup',
      label: `Startup priorities overlap`,
      tooltip: `Shared startup connection interests: ${listSummary(startupOverlap, 2)}.`,
    });
  }

  if (chips.length === 0) {
    chips.push({
      key: 'compatibility',
      label: `${score}% compatibility`,
      tooltip: 'Compatibility is based on profile structure and recent interaction signals.',
    });
  }

  const summaryParts = [];
  if (sameCollege) summaryParts.push('shared college context');
  if (sameCareer) summaryParts.push('aligned career focus');
  if (goalsOverlap.length > 0) summaryParts.push('goal alignment');
  if (circlesOverlap.length > 0) summaryParts.push('network overlap');

  const summary = summaryParts.length > 0
    ? `Strong match - ${summaryParts.slice(0, 3).join(', ')}.`
    : `Good match - compatibility is ${score}% from profile overlap and conversation context.`;

  return {
    version: 1,
    generated_at: generatedAt,
    score,
    summary,
    chips: chips.slice(0, 4),
    breakdown: {
      background,
      goals,
      network,
      stage,
    },
    source: 'connection_accept_snapshot',
  };
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
  return listOneRow(tables, PROFILES_TABLE, [
    Query.equal('user_id', userId),
  ]);
}

async function getProfileById(tables, profileId) {
  return getRowOrNull(tables, PROFILES_TABLE, profileId);
}

function ensureParticipant(connection, profileId) {
  const initiatorId = relationId(connection.initiator) || normalizeString(connection.initiator_profile_id);
  const responderId = relationId(connection.responder) || normalizeString(connection.responder_profile_id);
  if (initiatorId === profileId) return 'initiator';
  if (responderId === profileId) return 'responder';
  throw new HttpError(403, 'Not authorized to access this connection');
}

async function createRelationshipEvent(tables, { connectionId, actorId, eventType, details = '', voltz = 0, occurredAt = new Date().toISOString() }) {
  const row = await tables.createRow({
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
  return row;
}

async function createVoltzEntry(tables, { profileId, connectionId, relationshipEventId, eventType, amount, reason, awardedAt = new Date().toISOString() }) {
  const row = await tables.createRow({
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
  return row;
}

async function getCompatibilityScore(tables, userAId, userBId) {
  if (!userAId || !userBId) return 72;

  const direct = await listOneRow(tables, MATCHES_TABLE, [
    Query.equal('user_a_id', userAId),
    Query.equal('user_b_id', userBId),
  ]);

  if (direct && typeof direct.compatibility_score === 'number') {
    return Math.round(direct.compatibility_score);
  }

  const reverse = await listOneRow(tables, MATCHES_TABLE, [
    Query.equal('user_a_id', userBId),
    Query.equal('user_b_id', userAId),
  ]);

  if (reverse && typeof reverse.compatibility_score === 'number') {
    return Math.round(reverse.compatibility_score);
  }

  return 72;
}

async function getLatestMessage(tables, conversationId) {
  if (!conversationId) return null;

  const out = await tables.listRows({
    databaseId: DB_ID,
    tableId: MESSAGES_TABLE,
    queries: [
      Query.equal('conversation', conversationId),
      Query.orderDesc('sent_at'),
      Query.limit(1),
    ],
  });

  return out.rows?.[0] || null;
}

async function getUnreadCount(tables, conversationId, currentProfileId, lastReadAt) {
  if (!conversationId) return 0;

  const base = [
    Query.equal('conversation', conversationId),
    Query.notEqual('sender', currentProfileId),
    Query.notEqual('delivery_status', 'read'),
    Query.limit(100),
  ];

  const queries = lastReadAt ? [...base, Query.greaterThan('sent_at', lastReadAt)] : base;

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
      queries: [Query.equal('conversation', conversationId), Query.limit(100)],
    });

    const unread = fallback.rows.filter((row) => {
      const senderId = relationId(row.sender);
      if (senderId === currentProfileId) return false;
      if (row.delivery_status === 'read') return false;
      if (!lastReadAt) return true;
      return new Date(row.sent_at).getTime() > new Date(lastReadAt).getTime();
    });

    return unread.length;
  }
}

function mapPendingCard(connection, initiator, score) {
  const fullName = normalizeString(initiator?.full_name) || 'Unknown user';
  const opening = normalizeString(connection.opening_message_preview) || 'They would like to connect.';

  return {
    id: connection.$id,
    connection_id: connection.$id,
    initials: initialsFromName(fullName),
    color: colorFromName(fullName),
    name: fullName,
    role: profileRole(initiator),
    score,
    scoreTier: scoreTier(score),
    message: opening,
    dots: score >= 85
      ? ['#3DAA82', '#5B8CF5', '#9B7CF6']
      : score >= 70
        ? ['#3DAA82', '#5B8CF5', '#E8A94A']
        : ['#5B8CF5', '#9B7CF6'],
    initiated_at: connection.initiated_at,
  };
}

function mapConversationCard(connection, counterpart, latestMessage, unreadCount, isFromCurrentUser, lastReadAt) {
  const fullName = normalizeString(counterpart?.full_name) || 'Unknown user';
  const previewBody = normalizeString(latestMessage?.body);
  const quoted = previewBody ? `"${previewBody}"` : '"No messages yet"';
  const preview = isFromCurrentUser ? `You: ${quoted}` : quoted;
  const lastEventAt = latestMessage?.sent_at || connection.last_activity_at || connection.accepted_at || connection.initiated_at;
  const daysCold = dayDiffFromNow(lastEventAt);
  const attention = daysCold >= 7;

  return {
    id: relationId(connection.conversation) || connection.conversation_row_id || connection.$id,
    conversationId: relationId(connection.conversation) || connection.conversation_row_id || null,
    connectionId: connection.$id,
    name: fullName,
    role: profileRole(counterpart),
    initials: initialsFromName(fullName),
    color: colorFromName(fullName),
    cold: attention,
    preview,
    previewFromYou: isFromCurrentUser,
    timestamp: relativeTime(lastEventAt),
    unread: unreadCount,
    section: attention ? 'attention' : 'main',
    last_activity_at: lastEventAt,
    last_read_at: lastReadAt || null,
    compatibility_score_snapshot: Number(connection.compatibility_score_snapshot || 0) || null,
    compatibility_snapshot: parseCompatibilitySnapshot(connection.compatibility_snapshot_json),
  };
}

async function requireCurrentProfile(tables, req, body) {
  const currentUserId = resolveCurrentUserId(req, body);
  if (!currentUserId) {
    throw new HttpError(401, 'Unable to resolve current user id');
  }

  const profile = await getProfileByUserId(tables, currentUserId);
  if (!profile) {
    throw new HttpError(404, 'Current user profile not found');
  }

  return profile;
}

async function actionInitiateRequest({ tables, body, currentProfile }) {
  const targetProfileId = normalizeString(body.target_profile_id || body.targetProfileId || body.profile_id);
  const targetUserId = normalizeString(body.target_user_id || body.targetUserId);
  const openingMessage = truncate(normalizeString(body.opening_message || body.openingMessage || body.message) || 'Hey - I would love to connect.', 5000);
  const now = new Date().toISOString();

  if (!targetProfileId && !targetUserId) {
    throw new HttpError(400, 'target_profile_id or target_user_id is required');
  }

  const targetProfile = targetProfileId
    ? await getProfileById(tables, targetProfileId)
    : await getProfileByUserId(tables, targetUserId);

  if (!targetProfile) {
    throw new HttpError(404, 'Target profile not found');
  }

  if (targetProfile.$id === currentProfile.$id) {
    throw new HttpError(400, 'Cannot create a connection with yourself');
  }

  const pairKey = buildPairKey(currentProfile.$id, targetProfile.$id);
  const existing = await listOneRow(tables, CONNECTIONS_TABLE, [Query.equal('pair_key', pairKey)]);

  if (existing?.status === 'blocked') {
    throw new HttpError(409, 'Connection is blocked');
  }

  if (existing?.status === 'accepted') {
    return {
      success: true,
      already_connected: true,
      connection_id: existing.$id,
      conversation_id: relationId(existing.conversation) || existing.conversation_row_id || null,
    };
  }

  if (existing?.status === 'pending') {
    return {
      success: true,
      already_pending: true,
      connection_id: existing.$id,
    };
  }

  const rollback = [];
  let connection = existing;

  try {
    if (existing) {
      const snapshot = {
        initiator: relationId(existing.initiator),
        initiator_profile_id: existing.initiator_profile_id,
        responder: relationId(existing.responder),
        responder_profile_id: existing.responder_profile_id,
        status: existing.status,
        conversation: relationId(existing.conversation),
        conversation_row_id: existing.conversation_row_id || null,
        opening_message_id: existing.opening_message_id || null,
        opening_message_preview: existing.opening_message_preview || null,
        initiated_at: existing.initiated_at,
        accepted_at: existing.accepted_at || null,
        declined_at: existing.declined_at || null,
        blocked_at: existing.blocked_at || null,
        last_activity_at: existing.last_activity_at || null,
        compatibility_score_snapshot: existing.compatibility_score_snapshot || null,
        compatibility_snapshot_json: existing.compatibility_snapshot_json || null,
        compatibility_generated_at: existing.compatibility_generated_at || null,
      };

      await tables.updateRow({
        databaseId: DB_ID,
        tableId: CONNECTIONS_TABLE,
        rowId: existing.$id,
        data: {
          initiator: currentProfile.$id,
          initiator_profile_id: currentProfile.$id,
          responder: targetProfile.$id,
          responder_profile_id: targetProfile.$id,
          status: 'pending',
          conversation: null,
          conversation_row_id: null,
          opening_message_id: null,
          opening_message_preview: truncate(openingMessage, 500),
          initiated_at: now,
          accepted_at: null,
          declined_at: null,
          blocked_at: null,
          last_activity_at: now,
          compatibility_score_snapshot: null,
          compatibility_snapshot_json: null,
          compatibility_generated_at: null,
        },
      });

      rollback.push(async () => {
        await tables.updateRow({
          databaseId: DB_ID,
          tableId: CONNECTIONS_TABLE,
          rowId: existing.$id,
          data: snapshot,
        });
      });

      connection = await getRowOrNull(tables, CONNECTIONS_TABLE, existing.$id);
    } else {
      connection = await tables.createRow({
        databaseId: DB_ID,
        tableId: CONNECTIONS_TABLE,
        rowId: ID.unique(),
        data: {
          pair_key: pairKey,
          initiator: currentProfile.$id,
          initiator_profile_id: currentProfile.$id,
          responder: targetProfile.$id,
          responder_profile_id: targetProfile.$id,
          status: 'pending',
          conversation: null,
          conversation_row_id: null,
          opening_message_id: null,
          opening_message_preview: truncate(openingMessage, 500),
          initiated_at: now,
          accepted_at: null,
          declined_at: null,
          blocked_at: null,
          last_activity_at: now,
          compatibility_score_snapshot: null,
          compatibility_snapshot_json: null,
          compatibility_generated_at: null,
        },
      });

      rollback.push(async () => {
        await tables.deleteRow({
          databaseId: DB_ID,
          tableId: CONNECTIONS_TABLE,
          rowId: connection.$id,
        });
      });
    }

    const openingMessageRow = await tables.createRow({
      databaseId: DB_ID,
      tableId: MESSAGES_TABLE,
      rowId: ID.unique(),
      data: {
        conversation: null,
        sender: currentProfile.$id,
        body: openingMessage,
        message_type: 'text',
        delivery_status: 'delivered',
        is_edited: false,
        is_deleted: false,
        sent_at: now,
        reply_to_message_id: null,
      },
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: MESSAGES_TABLE,
        rowId: openingMessageRow.$id,
      });
    });

    await tables.updateRow({
      databaseId: DB_ID,
      tableId: CONNECTIONS_TABLE,
      rowId: connection.$id,
      data: {
        opening_message_id: openingMessageRow.$id,
        opening_message_preview: truncate(openingMessage, 500),
        last_activity_at: now,
      },
    });

    const eventRow = await createRelationshipEvent(tables, {
      connectionId: connection.$id,
      actorId: currentProfile.$id,
      eventType: 'outreach_sent',
      details: 'Initial outreach message sent.',
      voltz: VOLTZ_POINTS.message_sent,
      occurredAt: now,
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: REL_EVENTS_TABLE,
        rowId: eventRow.$id,
      });
    });

    const ledgerRow = await createVoltzEntry(tables, {
      profileId: currentProfile.$id,
      connectionId: connection.$id,
      relationshipEventId: eventRow.$id,
      eventType: 'message_sent',
      amount: VOLTZ_POINTS.message_sent,
      reason: 'Initial connection message sent',
      awardedAt: now,
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: VOLTZ_LEDGER_TABLE,
        rowId: ledgerRow.$id,
      });
    });

    return {
      success: true,
      connection_id: connection.$id,
      message_id: openingMessageRow.$id,
      voltz_earned: VOLTZ_POINTS.message_sent,
    };
  } catch (err) {
    for (const task of rollback.reverse()) {
      try {
        // Best-effort rollback to keep state coherent.
        // eslint-disable-next-line no-await-in-loop
        await task();
      } catch {
        // ignore rollback failures
      }
    }
    throw err;
  }
}

async function actionAcceptConnection({ tables, body, currentProfile }) {
  const connectionId = normalizeString(body.connection_id || body.connectionId);
  if (!connectionId) throw new HttpError(400, 'connection_id is required');

  const now = new Date().toISOString();
  const connection = await getRowOrNull(tables, CONNECTIONS_TABLE, connectionId);
  if (!connection) throw new HttpError(404, 'Connection not found');

  const participantRole = ensureParticipant(connection, currentProfile.$id);
  if (participantRole !== 'responder') {
    throw new HttpError(403, 'Only the receiving user can accept this connection');
  }
  if (connection.status !== 'pending') {
    throw new HttpError(400, 'Connection is not pending');
  }

  const initiatorId = relationId(connection.initiator);
  const responderId = relationId(connection.responder);

  const initiatorProfile = await getProfileById(tables, initiatorId);
  if (!initiatorProfile) throw new HttpError(404, 'Initiator profile not found');

  const baseScore = await getCompatibilityScore(tables, initiatorProfile.user_id, currentProfile.user_id);
  const compatibilitySnapshot = buildCompatibilitySnapshot({
    profileA: initiatorProfile,
    profileB: currentProfile,
    baseScore,
    generatedAt: now,
  });

  const rollback = [];
  let conversation = null;

  try {
    conversation = await tables.createRow({
      databaseId: DB_ID,
      tableId: CONVERSATIONS_TABLE,
      rowId: ID.unique(),
      data: {
        conversation_type: 'direct',
        title: normalizeString(initiatorProfile.full_name) || 'Direct conversation',
        is_archived: false,
        last_message_at: now,
        creator: currentProfile.$id,
      },
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: CONVERSATIONS_TABLE,
        rowId: conversation.$id,
      });
    });

    const initiatorMember = await tables.createRow({
      databaseId: DB_ID,
      tableId: CONVERSATION_MEMBERS_TABLE,
      rowId: ID.unique(),
      data: {
        conversation: conversation.$id,
        profile: initiatorId,
        role: 'member',
        muted: false,
        last_read_at: null,
      },
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: CONVERSATION_MEMBERS_TABLE,
        rowId: initiatorMember.$id,
      });
    });

    const responderMember = await tables.createRow({
      databaseId: DB_ID,
      tableId: CONVERSATION_MEMBERS_TABLE,
      rowId: ID.unique(),
      data: {
        conversation: conversation.$id,
        profile: responderId,
        role: 'member',
        muted: false,
        last_read_at: now,
      },
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: CONVERSATION_MEMBERS_TABLE,
        rowId: responderMember.$id,
      });
    });

    if (connection.opening_message_id) {
      const opening = await getRowOrNull(tables, MESSAGES_TABLE, connection.opening_message_id);
      if (opening) {
        const openingSnapshot = {
          conversation: relationId(opening.conversation),
          delivery_status: opening.delivery_status || 'sent',
        };

        await tables.updateRow({
          databaseId: DB_ID,
          tableId: MESSAGES_TABLE,
          rowId: opening.$id,
          data: {
            conversation: conversation.$id,
            delivery_status: 'delivered',
          },
        });

        rollback.push(async () => {
          await tables.updateRow({
            databaseId: DB_ID,
            tableId: MESSAGES_TABLE,
            rowId: opening.$id,
            data: openingSnapshot,
          });
        });
      }
    }

    const connectionSnapshot = {
      status: connection.status,
      conversation: relationId(connection.conversation),
      conversation_row_id: connection.conversation_row_id || null,
      accepted_at: connection.accepted_at || null,
      declined_at: connection.declined_at || null,
      blocked_at: connection.blocked_at || null,
      last_activity_at: connection.last_activity_at || null,
      compatibility_score_snapshot: connection.compatibility_score_snapshot || null,
      compatibility_snapshot_json: connection.compatibility_snapshot_json || null,
      compatibility_generated_at: connection.compatibility_generated_at || null,
    };

    await tables.updateRow({
      databaseId: DB_ID,
      tableId: CONNECTIONS_TABLE,
      rowId: connection.$id,
      data: {
        status: 'accepted',
        conversation: conversation.$id,
        conversation_row_id: conversation.$id,
        accepted_at: now,
        declined_at: null,
        blocked_at: null,
        last_activity_at: now,
        compatibility_score_snapshot: compatibilitySnapshot.score,
        compatibility_snapshot_json: JSON.stringify(compatibilitySnapshot),
        compatibility_generated_at: now,
      },
    });

    rollback.push(async () => {
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: CONNECTIONS_TABLE,
        rowId: connection.$id,
        data: connectionSnapshot,
      });
    });

    const eventRow = await createRelationshipEvent(tables, {
      connectionId: connection.$id,
      actorId: currentProfile.$id,
      eventType: 'connection_accepted',
      details: 'Connection request accepted.',
      voltz: VOLTZ_POINTS.connection_accepted,
      occurredAt: now,
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: REL_EVENTS_TABLE,
        rowId: eventRow.$id,
      });
    });

    const ledgerRow = await createVoltzEntry(tables, {
      profileId: currentProfile.$id,
      connectionId: connection.$id,
      relationshipEventId: eventRow.$id,
      eventType: 'connection_accepted',
      amount: VOLTZ_POINTS.connection_accepted,
      reason: 'Accepted a new connection request',
      awardedAt: now,
    });

    rollback.push(async () => {
      await tables.deleteRow({
        databaseId: DB_ID,
        tableId: VOLTZ_LEDGER_TABLE,
        rowId: ledgerRow.$id,
      });
    });

    return {
      success: true,
      connection_id: connection.$id,
      conversation_id: conversation.$id,
      voltz_earned: VOLTZ_POINTS.connection_accepted,
      compatibility_snapshot: compatibilitySnapshot,
      stage_progress: buildStageProgress('accepted'),
    };
  } catch (err) {
    for (const task of rollback.reverse()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await task();
      } catch {
        // ignore rollback failures
      }
    }
    throw err;
  }
}

async function actionDeclineConnection({ tables, body, currentProfile }) {
  const connectionId = normalizeString(body.connection_id || body.connectionId);
  if (!connectionId) throw new HttpError(400, 'connection_id is required');

  const now = new Date().toISOString();
  const connection = await getRowOrNull(tables, CONNECTIONS_TABLE, connectionId);
  if (!connection) throw new HttpError(404, 'Connection not found');

  const participantRole = ensureParticipant(connection, currentProfile.$id);
  if (participantRole !== 'responder') {
    throw new HttpError(403, 'Only the receiving user can decline this connection');
  }
  if (connection.status !== 'pending') {
    throw new HttpError(400, 'Connection is not pending');
  }

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: CONNECTIONS_TABLE,
    rowId: connection.$id,
    data: {
      status: 'declined',
      declined_at: now,
      accepted_at: null,
      blocked_at: null,
      last_activity_at: now,
    },
  });

  await createRelationshipEvent(tables, {
    connectionId: connection.$id,
    actorId: currentProfile.$id,
    eventType: 'declined',
    details: 'Connection request declined.',
    occurredAt: now,
  });

  return {
    success: true,
    connection_id: connection.$id,
    undo_expires_at: new Date(Date.now() + DECLINE_UNDO_MS).toISOString(),
  };
}

async function actionUndoDecline({ tables, body, currentProfile }) {
  const connectionId = normalizeString(body.connection_id || body.connectionId);
  if (!connectionId) throw new HttpError(400, 'connection_id is required');

  const now = new Date().toISOString();
  const connection = await getRowOrNull(tables, CONNECTIONS_TABLE, connectionId);
  if (!connection) throw new HttpError(404, 'Connection not found');

  const participantRole = ensureParticipant(connection, currentProfile.$id);
  if (participantRole !== 'responder') {
    throw new HttpError(403, 'Only the receiving user can undo a decline');
  }
  if (connection.status !== 'declined') {
    throw new HttpError(400, 'Connection is not in declined state');
  }

  const declinedAt = new Date(connection.declined_at || '').getTime();
  if (!Number.isFinite(declinedAt) || (Date.now() - declinedAt) > DECLINE_UNDO_MS) {
    throw new HttpError(400, 'Undo window has expired');
  }

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: CONNECTIONS_TABLE,
    rowId: connection.$id,
    data: {
      status: 'pending',
      declined_at: null,
      blocked_at: null,
      last_activity_at: now,
    },
  });

  await createRelationshipEvent(tables, {
    connectionId: connection.$id,
    actorId: currentProfile.$id,
    eventType: 'undone',
    details: 'Decline undone within grace window.',
    occurredAt: now,
  });

  return {
    success: true,
    connection_id: connection.$id,
  };
}

async function actionBlockConnection({ tables, body, currentProfile }) {
  const connectionId = normalizeString(body.connection_id || body.connectionId);
  if (!connectionId) throw new HttpError(400, 'connection_id is required');

  const now = new Date().toISOString();
  const connection = await getRowOrNull(tables, CONNECTIONS_TABLE, connectionId);
  if (!connection) throw new HttpError(404, 'Connection not found');

  ensureParticipant(connection, currentProfile.$id);

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: CONNECTIONS_TABLE,
    rowId: connection.$id,
    data: {
      status: 'blocked',
      blocked_at: now,
      accepted_at: null,
      declined_at: null,
      last_activity_at: now,
    },
  });

  await createRelationshipEvent(tables, {
    connectionId: connection.$id,
    actorId: currentProfile.$id,
    eventType: 'blocked',
    details: 'Connection blocked by user.',
    occurredAt: now,
  });

  return {
    success: true,
    connection_id: connection.$id,
  };
}

async function actionListPendingToMe({ tables, body, currentProfile }) {
  const limit = clampLimit(body.limit);
  const offset = clampOffset(body.offset);

  const queries = [
    Query.equal('responder_profile_id', currentProfile.$id),
    Query.equal('status', 'pending'),
    Query.orderDesc('initiated_at'),
    Query.limit(limit),
  ];
  if (offset > 0) queries.push(Query.offset(offset));

  const out = await tables.listRows({
    databaseId: DB_ID,
    tableId: CONNECTIONS_TABLE,
    queries,
  });

  const cards = [];
  for (const connection of out.rows) {
    const initiatorId = relationId(connection.initiator);
    const initiator = await getProfileById(tables, initiatorId);
    if (!initiator) continue;

    const score = await getCompatibilityScore(tables, currentProfile.user_id, initiator.user_id);
    cards.push(mapPendingCard(connection, initiator, score));
  }

  return {
    success: true,
    connections: cards,
    total: out.total ?? cards.length,
  };
}

async function actionListPendingFromMe({ tables, body, currentProfile }) {
  const limit = clampLimit(body.limit);
  const offset = clampOffset(body.offset);

  const queries = [
    Query.equal('initiator_profile_id', currentProfile.$id),
    Query.equal('status', 'pending'),
    Query.orderDesc('initiated_at'),
    Query.limit(limit),
  ];
  if (offset > 0) queries.push(Query.offset(offset));

  const out = await tables.listRows({
    databaseId: DB_ID,
    tableId: CONNECTIONS_TABLE,
    queries,
  });

  const items = [];
  for (const connection of out.rows) {
    const responderId = relationId(connection.responder);
    const responder = await getProfileById(tables, responderId);
    if (!responder) continue;

    items.push({
      connection_id: connection.$id,
      name: normalizeString(responder.full_name) || 'Unknown user',
      role: profileRole(responder),
      initiated_at: connection.initiated_at,
      status: connection.status,
    });
  }

  return {
    success: true,
    connections: items,
    total: out.total ?? items.length,
  };
}

async function actionListActive({ tables, body, currentProfile }) {
  const limit = clampLimit(body.limit);

  const [initiated, received] = await Promise.all([
    tables.listRows({
      databaseId: DB_ID,
      tableId: CONNECTIONS_TABLE,
      queries: [
        Query.equal('initiator_profile_id', currentProfile.$id),
        Query.equal('status', 'accepted'),
        Query.orderDesc('last_activity_at'),
        Query.limit(limit),
      ],
    }),
    tables.listRows({
      databaseId: DB_ID,
      tableId: CONNECTIONS_TABLE,
      queries: [
        Query.equal('responder_profile_id', currentProfile.$id),
        Query.equal('status', 'accepted'),
        Query.orderDesc('last_activity_at'),
        Query.limit(limit),
      ],
    }),
  ]);

  const dedup = new Map();
  for (const row of [...initiated.rows, ...received.rows]) {
    dedup.set(row.$id, row);
  }

  const cards = [];
  for (const connection of dedup.values()) {
    const initiatorId = relationId(connection.initiator) || connection.initiator_profile_id;
    const responderId = relationId(connection.responder) || connection.responder_profile_id;
    const counterpartyId = initiatorId === currentProfile.$id ? responderId : initiatorId;
    const counterparty = await getProfileById(tables, counterpartyId);
    if (!counterparty) continue;

    const conversationId = relationId(connection.conversation) || connection.conversation_row_id;
    let latestMessage = null;
    let unreadCount = 0;
    let memberRow = null;

    if (conversationId) {
      latestMessage = await getLatestMessage(tables, conversationId);
      memberRow = await listOneRow(tables, CONVERSATION_MEMBERS_TABLE, [
        Query.equal('conversation', conversationId),
        Query.equal('profile', currentProfile.$id),
      ]);

      unreadCount = await getUnreadCount(
        tables,
        conversationId,
        currentProfile.$id,
        memberRow?.last_read_at || null
      );
    }

    const senderId = relationId(latestMessage?.sender);
    const isFromCurrent = senderId === currentProfile.$id;

    cards.push(mapConversationCard(
      connection,
      counterparty,
      latestMessage,
      unreadCount,
      isFromCurrent,
      memberRow?.last_read_at || null
    ));
  }

  cards.sort((a, b) => {
    if (a.section !== b.section) return a.section === 'attention' ? -1 : 1;
    const aTs = new Date(a.last_activity_at || 0).getTime();
    const bTs = new Date(b.last_activity_at || 0).getTime();
    return bTs - aTs;
  });

  return {
    success: true,
    conversations: cards,
    total: cards.length,
  };
}

function deriveStage(events, messagesTotal, status) {
  const types = new Set(events.map((event) => event.event_type));
  if (types.has('introduction_made')) return 'introduction_made';
  if (types.has('coffee_done')) return 'coffee_done';
  if (types.has('call_booked')) return 'call_booked';
  if (status === 'accepted' && messagesTotal > 0) return 'first_reply';
  if (status === 'accepted') return 'accepted';
  if (status === 'pending') return 'pending';
  if (status === 'declined') return 'declined';
  return status || 'unknown';
}

async function actionGetConnection({ tables, body, currentProfile }) {
  const connectionId = normalizeString(body.connection_id || body.connectionId);
  if (!connectionId) throw new HttpError(400, 'connection_id is required');

  const connection = await getRowOrNull(tables, CONNECTIONS_TABLE, connectionId);
  if (!connection) throw new HttpError(404, 'Connection not found');

  ensureParticipant(connection, currentProfile.$id);

  const eventsOut = await tables.listRows({
    databaseId: DB_ID,
    tableId: REL_EVENTS_TABLE,
    queries: [
      Query.equal('connection_row_id', connection.$id),
      Query.orderDesc('occurred_at'),
      Query.limit(100),
    ],
  });

  const events = eventsOut.rows.map((row) => ({
    id: row.$id,
    event_type: row.event_type,
    occurred_at: row.occurred_at,
    details: row.details || null,
    voltz_awarded: row.voltz_awarded || 0,
    actor: relationId(row.actor),
  }));

  const conversationId = relationId(connection.conversation) || connection.conversation_row_id;
  let messagesTotal = 0;
  let lastContactAt = null;
  let responseRate = 0;
  let compatibilitySnapshot = parseCompatibilitySnapshot(connection.compatibility_snapshot_json);
  let messageRows = [];

  if (conversationId) {
    const messagesOut = await tables.listRows({
      databaseId: DB_ID,
      tableId: MESSAGES_TABLE,
      queries: [
        Query.equal('conversation', conversationId),
        Query.orderDesc('sent_at'),
        Query.limit(200),
      ],
    });

    messageRows = Array.isArray(messagesOut.rows) ? messagesOut.rows : [];
    messagesTotal = messagesOut.total ?? messageRows.length;
    lastContactAt = messageRows[0]?.sent_at || null;

    const sentByCurrent = messageRows.filter((row) => relationId(row.sender) === currentProfile.$id).length;
    const sentByOther = messageRows.length - sentByCurrent;
    responseRate = sentByCurrent === 0 ? 0 : Math.min(100, Math.round((sentByOther / sentByCurrent) * 100));
  }

  const voltzRows = await tables.listRows({
    databaseId: DB_ID,
    tableId: VOLTZ_LEDGER_TABLE,
    queries: [
      Query.equal('connection_row_id', connection.$id),
      Query.equal('profile_row_id', currentProfile.$id),
      Query.limit(200),
    ],
  });

  const voltzTotal = voltzRows.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const currentStage = deriveStage(events, messagesTotal, connection.status);
  const stageProgress = buildStageProgress(currentStage);
  const relationshipStrengthSeries = buildRelationshipStrengthSeries({
    connection,
    events,
    messages: messageRows,
  });
  const relationshipStrength = relationshipStrengthSeries[relationshipStrengthSeries.length - 1]?.score || 0;

  if (!compatibilitySnapshot && (connection.status === 'accepted' || connection.status === 'pending')) {
    const initiatorId = relationId(connection.initiator) || connection.initiator_profile_id;
    const responderId = relationId(connection.responder) || connection.responder_profile_id;
    const [initiatorProfile, responderProfile] = await Promise.all([
      getProfileById(tables, initiatorId),
      getProfileById(tables, responderId),
    ]);

    if (initiatorProfile && responderProfile) {
      const generatedAt = connection.compatibility_generated_at || new Date().toISOString();
      const fallbackBaseScore = await getCompatibilityScore(
        tables,
        initiatorProfile.user_id,
        responderProfile.user_id
      );

      compatibilitySnapshot = buildCompatibilitySnapshot({
        profileA: initiatorProfile,
        profileB: responderProfile,
        baseScore: Number(connection.compatibility_score_snapshot || 0) || fallbackBaseScore,
        generatedAt,
      });

      try {
        await tables.updateRow({
          databaseId: DB_ID,
          tableId: CONNECTIONS_TABLE,
          rowId: connection.$id,
          data: {
            compatibility_score_snapshot: compatibilitySnapshot.score,
            compatibility_snapshot_json: JSON.stringify(compatibilitySnapshot),
            compatibility_generated_at: generatedAt,
          },
        });
      } catch {
        // Non-fatal: response still returns computed snapshot.
      }
    }
  }

  return {
    success: true,
    connection: {
      id: connection.$id,
      status: connection.status,
      initiator: relationId(connection.initiator),
      initiator_profile_id: connection.initiator_profile_id || relationId(connection.initiator),
      responder: relationId(connection.responder),
      responder_profile_id: connection.responder_profile_id || relationId(connection.responder),
      conversation_id: conversationId,
      conversation_row_id: connection.conversation_row_id || conversationId,
      initiated_at: connection.initiated_at,
      accepted_at: connection.accepted_at,
      declined_at: connection.declined_at,
      blocked_at: connection.blocked_at,
      last_activity_at: connection.last_activity_at,
      opening_message_preview: connection.opening_message_preview || null,
      compatibility_score_snapshot: Number(connection.compatibility_score_snapshot || compatibilitySnapshot?.score || 0) || null,
      compatibility_generated_at: connection.compatibility_generated_at || compatibilitySnapshot?.generated_at || null,
      compatibility_snapshot: compatibilitySnapshot || null,
    },
    events,
    metrics: {
      exchange_count: messagesTotal,
      last_contact_at: lastContactAt,
      response_rate: responseRate,
      relationship_strength: relationshipStrength,
      relationship_strength_series: relationshipStrengthSeries,
      current_stage: currentStage,
      stage_progress: stageProgress,
      stage_logic: 'deterministic_events',
      llm_stage_autoadvance: 'NOT_YET',
      voltz_earned: voltzTotal,
    },
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
      case 'initiate_request':
      case 'create_connection':
      case 'create_connection_request':
        payload = await actionInitiateRequest({ tables, body, currentProfile });
        break;
      case 'accept_connection':
        payload = await actionAcceptConnection({ tables, body, currentProfile });
        break;
      case 'decline_connection':
        payload = await actionDeclineConnection({ tables, body, currentProfile });
        break;
      case 'undo_decline':
        payload = await actionUndoDecline({ tables, body, currentProfile });
        break;
      case 'block_connection':
        payload = await actionBlockConnection({ tables, body, currentProfile });
        break;
      case 'list_pending_to_me':
        payload = await actionListPendingToMe({ tables, body, currentProfile });
        break;
      case 'list_pending_from_me':
        payload = await actionListPendingFromMe({ tables, body, currentProfile });
        break;
      case 'list_active':
      case 'list_connections':
        payload = await actionListActive({ tables, body, currentProfile });
        break;
      case 'get_connection':
        payload = await actionGetConnection({ tables, body, currentProfile });
        break;
      default:
        throw new HttpError(400, `Unknown action: ${action}`);
    }

    return res.json(payload);
  } catch (err) {
    if (err.status && err.status < 500) {
      if (log) log(`connectionGateway ${err.status}: ${err.message}`);
      return res.json({ error: err.message }, err.status);
    }

    if (error) {
      error(`connectionGateway fatal: ${err.message}`);
      if (err.stack) error(err.stack);
    }
    Sentry.captureException(err);

    return res.json({ error: err.message || 'Internal error' }, err.status || 500);
  }
};
