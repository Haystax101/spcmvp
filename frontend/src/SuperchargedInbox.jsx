import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  account,
  functions,
  tables,
  client,
  realtime,
  DB_ID,
  PROFILES_TABLE,
  CONNECTION_GATEWAY_FUNCTION_ID,
  MESSAGE_GATEWAY_FUNCTION_ID,
  Query,
} from "./lib/appwrite";
import { readCacheEntry, removeCacheEntry, writeCacheEntry } from "./lib/cache";
import { VoltzWallet } from "./components/VoltzSystem";
import NotificationsPanel from "./components/NotificationsPanel";

// ============================================================================
// DATA
// ============================================================================

const AVATAR_COLORS = {
  purple: "#7B5CF0",
  blue: "#3B82F6",
  green: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  violet: "#8B6DD3",
  teal: "#2A9F7F",
  orange: "#C96B44",
  sky: "#5B8CF5"
};

const SARAH_MESSAGES = [
  { type: "sep", text: "Yesterday · 4:12 PM" },
  { type: "in", text: "Hey — got your note. Appreciate the thoughtful pitch, most cold emails aren't this specific." },
  { type: "out", text: "Thank you — tried to make sure it actually landed. Would love 20 min if you're open to it.", time: "4:28 PM", read: true },
  { type: "in", text: "Sure. What's the best way to get a sense of what you're building before we hop on?" },
  { type: "sep", text: "Today · 9:24 AM" },
  { type: "out", text: "I'll send over a short deck. Would Thursday afternoon work? Flexible around your calendar.", time: "9:26 AM", read: true },
  { type: "in", text: "Thursday works — send me the deck beforehand? Also, quick q: how are you thinking about the B2B wedge vs going direct to consumer first?" }
];

const AI_SECONDARY_FILLS = [
  { label: "Ask about the B2B angle", fill: "Happy to dig into the B2B wedge — the short version is we think teams buy first because the pain is measurable, but the shape of the product works for individuals too." },
  { label: "Suggest Thursday 2pm",    fill: "Thursday at 2pm? I'll send the deck over first thing Wednesday." },
  { label: "Send the deck",           fill: "Sending the deck now — let me know if anything sparks questions." }
];

const TONE_OPTIONS = ["warm", "direct", "curious", "confident"];

const DEFAULT_DRAFT = "Thursday works great — let's do 2pm. I'll send the deck Wednesday morning so you have time with it. On the B2B wedge: we lead with teams because the pain is measurable there, but the product is designed to feel personal too.";

const VOLTZ_EVENTS = {
  message_sent: 2,
  reply_received: 5,
  exchange_5: 10,
  exchange_10: 15,
  nudge_responded: 8,
  call_booked: 25,
  coffee_arranged: 20,
  introduction_made: 30,
  ai_draft_used: 3,
  stage_advanced: 12
};

const NOTIF_KIND_UNREAD = "unread_message";
const NOTIF_KIND_ATTENTION = "attention_thread";
const NOTIF_KIND_PENDING = "pending_request";

const STAGE_FLOW = ["accepted", "first_reply", "call_booked", "coffee_done", "introduction_made"];
const STAGE_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  first_reply: "First reply",
  call_booked: "Call booked",
  coffee_done: "Coffee done",
  introduction_made: "Introduction made",
  declined: "Declined",
  blocked: "Blocked",
};

const EVENT_LABELS = {
  outreach_sent: "Outreach sent",
  connection_accepted: "Connection accepted",
  declined: "Declined",
  undone: "Decline undone",
  blocked: "Blocked",
  message_sent: "Message sent",
  message_read: "Message read",
  call_booked: "Call booked",
  coffee_done: "Coffee done",
  introduction_made: "Introduction made",
  milestone_5_exchanges: "5 exchanges reached",
  milestone_10_exchanges: "10 exchanges reached",
};

const DEFAULT_CONTEXT_CHIPS = [
  {
    key: "compatibility",
    label: "Compatibility snapshot",
    tooltip: "Compatibility chips become concrete once the connection snapshot is available.",
  },
  {
    key: "goals",
    label: "Goal alignment",
    tooltip: "Shared goals are derived from profile overlap and then frozen for this connection.",
  },
  {
    key: "network",
    label: "Network overlap",
    tooltip: "Network overlap is based on profile circles and mutual connection intent.",
  },
  {
    key: "stage",
    label: "Stage context",
    tooltip: "Stage progression is deterministic from events and message activity.",
  },
];

const DEFAULT_RELATIONSHIP_CONTEXT = {
  score: 0,
  summary: "Match data will hydrate as conversation context loads.",
  chips: DEFAULT_CONTEXT_CHIPS,
  breakdown: {
    background: 0,
    goals: 0,
    network: 0,
    stage: 0,
  },
  exchangeCount: 0,
  lastContactAt: null,
  responseRate: 0,
  voltzEarned: 0,
  events: [],
  relationshipStrengthSeries: [],
  stageProgress: {
    current_stage: "pending",
    current_label: "Pending",
    completed_steps: 0,
    total_steps: STAGE_FLOW.length,
    steps: STAGE_FLOW.map((key) => ({
      key,
      label: STAGE_LABELS[key],
      done: false,
    })),
    logic_source: "deterministic_events",
    llm_stage_autoadvance: "NOT_YET",
  },
};

const getDefaultRelationshipContext = () => ({
  ...DEFAULT_RELATIONSHIP_CONTEXT,
  chips: DEFAULT_RELATIONSHIP_CONTEXT.chips.map((chip) => ({ ...chip })),
  breakdown: { ...DEFAULT_RELATIONSHIP_CONTEXT.breakdown },
  events: [],
  relationshipStrengthSeries: [...DEFAULT_RELATIONSHIP_CONTEXT.relationshipStrengthSeries],
  stageProgress: {
    ...DEFAULT_RELATIONSHIP_CONTEXT.stageProgress,
    steps: DEFAULT_RELATIONSHIP_CONTEXT.stageProgress.steps.map((step) => ({ ...step })),
  },
});

const clampPct = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const normalizeStageProgress = (rawStageProgress, currentStage) => {
  const completed = Number.isFinite(Number(rawStageProgress?.completed_steps))
    ? Number(rawStageProgress.completed_steps)
    : (() => {
        const idx = STAGE_FLOW.indexOf(currentStage);
        return idx >= 0 ? idx + 1 : 0;
      })();

  return {
    current_stage: currentStage || rawStageProgress?.current_stage || "pending",
    current_label: rawStageProgress?.current_label || STAGE_LABELS[currentStage] || "Pending",
    completed_steps: Math.max(0, Math.min(STAGE_FLOW.length, completed)),
    total_steps: STAGE_FLOW.length,
    steps: STAGE_FLOW.map((key, index) => ({
      key,
      label: STAGE_LABELS[key],
      done: index < completed,
    })),
    logic_source: rawStageProgress?.logic_source || "deterministic_events",
    llm_stage_autoadvance: rawStageProgress?.llm_stage_autoadvance || "NOT_YET",
  };
};

const normalizeChips = (rawChips) => {
  if (!Array.isArray(rawChips) || rawChips.length === 0) {
    return DEFAULT_CONTEXT_CHIPS;
  }

  return rawChips
    .map((chip, index) => {
      const key = typeof chip?.key === "string" && chip.key.trim() ? chip.key.trim() : `chip-${index}`;
      const label = typeof chip?.label === "string" && chip.label.trim() ? chip.label.trim() : "Profile signal";
      const tooltip = typeof chip?.tooltip === "string" && chip.tooltip.trim()
        ? chip.tooltip.trim()
        : "Derived from frozen compatibility snapshot at chat initialization.";
      return { key, label, tooltip };
    })
    .slice(0, 4);
};

const formatRelativeLastContact = (iso) => {
  if (!iso) return "--";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "--";

  const diffMinutes = Math.floor((Date.now() - ts) / 60000);
  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
};

const formatEventDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatChartDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const normalizeRelationshipStrengthSeries = (rawSeries) => {
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
    return [{ at: new Date().toISOString(), score: 0, source: "baseline" }];
  }

  const cleaned = rawSeries
    .map((point) => {
      const candidate = point?.at || point?.timestamp || point?.occurred_at || "";
      const parsed = new Date(candidate);
      const ms = parsed.getTime();
      if (!Number.isFinite(ms)) return null;
      const ts = new Date(ms).toISOString();
      const score = clampPct(point?.score, 0);
      return { at: ts, score, source: point?.source || "signal" };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (cleaned.length === 0) {
    return [{ at: new Date().toISOString(), score: 0, source: "baseline" }];
  }

  if (cleaned.length === 1) {
    return [cleaned[0], { ...cleaned[0], source: "latest" }];
  }

  return cleaned;
};

const eventDotColor = (eventType) => {
  if (eventType === "outreach_sent") return "#5B8CF5";
  if (eventType === "connection_accepted" || eventType === "first_reply") return "#3DAA82";
  if (eventType === "call_booked" || eventType === "coffee_done") return "#E8A94A";
  if (eventType === "introduction_made") return "#9B7CF6";
  return "#AFAFAF";
};

const signalColorForChipKey = (chipKey) => {
  const key = String(chipKey || "").toLowerCase();
  if (key.includes("college") || key.includes("subject") || key.includes("background")) return "#5B8CF5";
  if (key.includes("goals")) return "#3DAA82";
  if (key.includes("network") || key.includes("circle")) return "#9B7CF6";
  if (key.includes("stage") || key.includes("career") || key.includes("compat")) return "#E8A94A";
  return "#AFAFAF";
};

const buildRelationshipContext = (payload) => {
  if (!payload) return getDefaultRelationshipContext();

  const connection = payload.connection || {};
  const metrics = payload.metrics || {};
  const snapshot = connection.compatibility_snapshot || payload.compatibility_snapshot || null;
  const currentStage = metrics.current_stage || payload.stage_progress?.current_stage || connection.status || "pending";

  const breakdown = {
    background: clampPct(snapshot?.breakdown?.background, DEFAULT_RELATIONSHIP_CONTEXT.breakdown.background),
    goals: clampPct(snapshot?.breakdown?.goals, DEFAULT_RELATIONSHIP_CONTEXT.breakdown.goals),
    network: clampPct(snapshot?.breakdown?.network, DEFAULT_RELATIONSHIP_CONTEXT.breakdown.network),
    stage: clampPct(snapshot?.breakdown?.stage, DEFAULT_RELATIONSHIP_CONTEXT.breakdown.stage),
  };

  const relationshipStrengthSeries = normalizeRelationshipStrengthSeries(metrics.relationship_strength_series);
  const latestStrength = relationshipStrengthSeries[relationshipStrengthSeries.length - 1]?.score;
  const fallbackScore = connection.compatibility_score_snapshot ?? DEFAULT_RELATIONSHIP_CONTEXT.score;

  return {
    score: clampPct(metrics.relationship_strength ?? latestStrength ?? snapshot?.score ?? fallbackScore, DEFAULT_RELATIONSHIP_CONTEXT.score),
    summary: snapshot?.summary || DEFAULT_RELATIONSHIP_CONTEXT.summary,
    chips: normalizeChips(snapshot?.chips),
    breakdown,
    exchangeCount: Number(metrics.exchange_count || 0),
    lastContactAt: metrics.last_contact_at || connection.last_activity_at || null,
    responseRate: clampPct(metrics.response_rate, 0),
    voltzEarned: Number(metrics.voltz_earned || 0),
    events: Array.isArray(payload.events) ? payload.events : [],
    relationshipStrengthSeries,
    stageProgress: normalizeStageProgress(metrics.stage_progress || payload.stage_progress, currentStage),
  };
};

const milestoneStatus = (stageProgress, stageKey) => {
  const idx = STAGE_FLOW.indexOf(stageKey);
  if (idx < 0) return "locked";
  if (idx < stageProgress.completed_steps) return "done";
  if (idx === stageProgress.completed_steps) return "pending";
  return "locked";
};

const HAS_BACKEND_GATEWAYS = Boolean(CONNECTION_GATEWAY_FUNCTION_ID && MESSAGE_GATEWAY_FUNCTION_ID);
const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;
const INBOX_CACHE_TTL_MS = 5 * 60 * 1000;
const THREAD_CACHE_TTL_MS = 10 * 60 * 1000;
const INBOX_CACHE_KEY = (profileId) => `supercharged:inbox:v2:${profileId}`;
const THREAD_CACHE_KEY = (profileId, conversationId) => `supercharged:thread:v1:${profileId}:${conversationId}`;

const formatChatTime = (iso) => {
  if (!iso) return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatDayLabel = (iso) => {
  const d = new Date(iso || Date.now());
  if (!Number.isFinite(d.getTime())) return "Today";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

const mapConversationFromBackend = (row) => {
  if (!row) return null;

  const id = row.conversationId || row.id;
  if (!id) return null;

  return {
    id,
    conversationId: row.conversationId || id,
    connectionId: row.connectionId || row.connection_id || null,
    name: row.name || "Unknown user",
    role: row.role || "Oxford member",
    initials: row.initials || "??",
    color: row.color || "#7B5CF0",
    cold: Boolean(row.cold),
    preview: row.preview || '"No messages yet"',
    previewFromYou: Boolean(row.previewFromYou),
    timestamp: row.timestamp || "Now",
    unread: Number(row.unread || 0),
    section: row.section === "attention" ? "attention" : "main",
    compatibilityScoreSnapshot: Number(row.compatibility_score_snapshot || 0) || null,
    compatibilitySnapshot: row.compatibility_snapshot || null,
  };
};

const mapNewConnectionFromBackend = (row) => {
  if (!row) return null;

  const id = row.connection_id || row.id;
  if (!id) return null;

  return {
    id,
    connectionId: id,
    initials: row.initials || "??",
    color: row.color || "#7B5CF0",
    name: row.name || "Unknown user",
    role: row.role || "Oxford member",
    score: Number(row.score || 72),
    scoreTier: row.scoreTier || row.score_tier || "mid",
    message: row.message || "Would like to connect.",
    dots: Array.isArray(row.dots) && row.dots.length > 0
      ? row.dots
      : ["#3DAA82", "#5B8CF5", "#9B7CF6"]
  };
};

const mapSentConnectionFromBackend = (row) => {
  if (!row) return null;
  const id = row.connection_id || row.id;
  if (!id) return null;
  const name = row.name || 'Unknown user';
  return {
    id,
    name,
    role: row.role || 'Oxford member',
    initials: row.initials || name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    color: row.color || '#7B5CF0',
    message: row.message || 'Awaiting response',
    time: row.initiated_at ? new Date(row.initiated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
    status: row.status || 'pending',
  };
};

const mapMessagesToThread = (rows, currentProfileId) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const out = [];
  let lastDay = null;

  rows.forEach((m) => {
    const sentAt = m.sent_at || new Date().toISOString();
    const day = formatDayLabel(sentAt);
    if (day !== lastDay) {
      out.push({ type: "sep", text: day });
      lastDay = day;
    }

    const direction = m.direction || (m.sender_profile_id === currentProfileId ? "out" : "in");
    if (direction === "out") {
      out.push({
        id: m.id,
        type: "out",
        text: m.body,
        time: formatChatTime(sentAt),
        read: m.delivery_status === "read",
      });
    } else {
      out.push({
        id: m.id,
        type: "in",
        text: m.body,
      });
    }
  });

  return out;
};

// ============================================================================
// SMALL UI PARTS
// ============================================================================

const BoltIcon = ({ size = 11, strokeColor = "#1A1A1A" }) => {
  const h = Math.round((size * 13) / 10);
  return (
    <svg width={size} height={h} viewBox="0 0 10 13" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5.5 0L0 7.5h3.5L4 13l5.5-7.5H6L5.5 0z" fill="#F5C842" stroke={strokeColor} strokeWidth="0.8" strokeLinejoin="round"/>
    </svg>
  );
};

const Avatar = ({ initials, color, size = 46, className = "", style = {}, cold = false, fontSize }) => (
  <div
    className={`sc-avatar ${cold ? "sc-avatar-cold" : ""} ${className}`}
    style={{
      width: size, height: size, borderRadius: "50%",
      background: color, display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 600,
      fontSize: fontSize ?? Math.max(10, Math.round(size / 3.07)),
      flexShrink: 0, ...style
    }}
  >
    {initials}
  </div>
);

// ============================================================================
// INBOX HEADER
// ============================================================================

const BellButton = ({ onClick, hasPip }) => (
  <button className="sc-bell-btn" onClick={onClick} aria-label="Notifications">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3a5 5 0 00-5 5v3.5c0 .8-.3 1.6-.9 2.2L4 15h14l-1.1-1.3c-.6-.6-.9-1.4-.9-2.2V8a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    {hasPip && <span className="sc-bell-pip" />}
  </button>
);

const Search = ({ value, onChange }) => (
  <label className="sc-search">
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#AFAFAF" strokeWidth="1.5"/>
      <path d="M10.5 10.5L14 14" stroke="#AFAFAF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <input
      type="text"
      placeholder="Search connections..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

const FilterChips = ({ active, counts, onChange }) => {
  const items = [
    { key: "all",    label: "All",    count: counts.all,    tone: "red" },
    { key: "unread", label: "Unread", count: counts.unread, tone: "red" },
    { key: "new",    label: "New",    count: counts.new,    tone: "green" },
    { key: "sent",   label: "Sent",   count: counts.sent,   tone: "purple" }
  ];
  return (
    <div className="sc-filter-wrap">
      <div className="sc-filter-chips">
        {items.map(it => (
          <button
            key={it.key}
            className={`sc-chip ${active === it.key ? "active" : ""}`}
            onClick={() => onChange(it.key)}
          >
            {it.label}
            {it.count > 0 && (
              <span className={`sc-chip-badge ${it.tone === "green" ? "green" : it.tone === "purple" ? "purple" : ""}`}>{it.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// INBOX SECTIONS
// ============================================================================

const TodaysMoves = ({ onOpenMove, moves = [] }) => (
  <>
    <div className="sc-section-label-row">
      <div className="sc-section-label">Today's moves</div>
      <span className="sc-section-badge">{moves.length}</span>
    </div>
    <div className="sc-moves-row">
      {moves.map(m => (
        <div key={m.id} className="sc-move-card" onClick={() => onOpenMove(m.convoId, false)}>
          <div className="sc-move-top">
            <Avatar initials={m.initials} color={m.color} size={24} fontSize={10} />
            <div>
              <div className="sc-move-name">{m.name}</div>
              <div className="sc-move-role">{m.role}</div>
            </div>
          </div>
          <div className="sc-move-reason">{m.reason}</div>
          <button
            className="sc-move-cta"
            onClick={(e) => { e.stopPropagation(); onOpenMove(m.convoId, true); }}
          >
            <BoltIcon />
            Draft with AI
          </button>
        </div>
      ))}
    </div>
    <div className="sc-section-divider" />
  </>
);

const ConvoRow = ({ c, onOpen }) => (
  <div className="sc-convo" onClick={() => onOpen(c.id)}>
    {c.unread > 0 && <span className="sc-unread-dot" />}
    <Avatar initials={c.initials} color={c.color} cold={c.cold} />
    <div className="sc-convo-content">
      <div className={`sc-convo-name ${c.unread === 0 ? "read" : ""}`}>{c.name}</div>
      <div className="sc-convo-sub">{c.role}</div>
      <div className={`sc-convo-preview ${c.unread === 0 ? "read" : ""}`}>{c.preview}</div>
    </div>
    <div className="sc-convo-right">
      <div className="sc-timestamp">{c.timestamp}</div>
      {c.unread > 0 && <div className="sc-unread-badge">{c.unread}</div>}
    </div>
    <span className="sc-swipe-affordance" />
  </div>
);

const EmptyState = ({ children }) => <div className="sc-empty-state">{children}</div>;

const SentCard = ({ conn }) => (
  <div className="sc-new-card">
    <div className="sc-new-card-top">
      <Avatar initials={conn.initials} color={conn.color} />
      <div className="sc-new-card-info">
        <div className="sc-new-card-name">{conn.name}</div>
        <div className="sc-new-card-role">{conn.role}</div>
      </div>
      <div className="sc-timestamp">{conn.time}</div>
    </div>
    <div className="sc-new-card-msg">{conn.message}</div>
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: conn.status === 'declined' ? '#C0392B' : '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {conn.status === 'pending' ? '⏳ Awaiting reply' : conn.status === 'declined' ? '✗ Declined' : conn.status}
      </span>
    </div>
  </div>
);

const SentFeed = ({ connections }) => (
  <div className="sc-inbox-scroll">
    {connections.length === 0 ? (
      <EmptyState>No sent requests yet</EmptyState>
    ) : (
      connections.map(c => <SentCard key={c.id} conn={c} />)
    )}
  </div>
);

const LoadingState = ({ label = "Loading inbox..." }) => (
  <div className="sc-loading-state" role="status" aria-live="polite">
    <span className="sc-loading-spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

// ============================================================================
// NEW CONNECTIONS FEED
// ============================================================================

const NewCard = ({ conn, onOpen, onReplyAI }) => (
  <div className="sc-new-card" onClick={() => onOpen(conn)}>
    <div className="sc-new-card-top">
      <Avatar initials={conn.initials} color={conn.color} />
      <div className="sc-new-card-info">
        <div className="sc-new-card-name">{conn.name}</div>
        <div className="sc-new-card-role">{conn.role}</div>
      </div>
      <span className={`sc-score-badge ${conn.scoreTier}`}>{conn.score}%</span>
    </div>
    <div className="sc-new-card-msg">{conn.message}</div>
    <div className="sc-new-card-foot">
      <div className="sc-new-card-dots">
        {conn.dots.map((d, i) => (
          <span key={i} className="sc-new-card-dot" style={{ background: d }} />
        ))}
      </div>
      <div className="sc-new-card-ctas">
        <button
          className="sc-new-cta-primary"
          onClick={(e) => { e.stopPropagation(); onReplyAI(conn); }}
        >
          <BoltIcon size={9} />
          Reply with AI
        </button>
        <button
          className="sc-new-cta-open"
          onClick={(e) => { e.stopPropagation(); onOpen(conn); }}
        >
          Open
        </button>
      </div>
    </div>
  </div>
);

const NewFeed = ({ connections, onOpen, onReplyAI }) => (
  <div className="sc-inbox-scroll">
    <div className="sc-section-label" style={{ paddingTop: 18 }}>
      New connections · {connections.length}
    </div>
    {connections.length === 0 ? (
      <EmptyState>No new connections right now</EmptyState>
    ) : (
      <div className="sc-new-feed">
        {connections.map(c => (
          <NewCard key={c.id} conn={c} onOpen={onOpen} onReplyAI={onReplyAI} />
        ))}
      </div>
    )}
  </div>
);

// ============================================================================
// NOTIFICATIONS PANEL
// ============================================================================

const NotifPanel = ({ open, items, onItemClick, onMarkAllRead, markingAllRead, panelRef, setNotifOpen }) => {
  if (!open) return null;

  // Transform legacy notification format to new format
  const transformedNotifications = items.map((n) => ({
    id: n.id || n.initials,
    type: "initials",
    initials: n.initials,
    avatarBg: {
      "red": "#E5484D",
      "orange": "#F97316",
      "amber": "#F5B800",
      "green": "#22B37A",
      "teal": "#14B8A6",
      "blue": "#3B82F6",
      "purple": "#7C6BF2",
      "pink": "#F87171"
    }[n.color] || "#7C6BF2",
    body: n.text || n.body,
    time: n.time || "now",
    draft: false,
    read: false,
  }));

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000, // Ensure it's above everything
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "flex-end", // Align to bottom
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        transition: "opacity 300ms ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setNotifOpen(false);
        }
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 500, // Slightly wider for mobile comfort
          maxHeight: "85vh",
          animation: "slideUp 320ms cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
        <NotificationsPanel
          notifications={transformedNotifications}
          onNotificationPress={onItemClick}
          onDraftPress={() => {}}
          onMarkAllRead={onMarkAllRead}
        />
      </div>
    </div>
  );
};

// ============================================================================
// INBOX (assembled)
// ============================================================================

const Inbox = ({
  conversations, newConnections, sentConnections, notifications, filter, onFilter, loading, error,
  notifOpen, setNotifOpen,
  onOpenConvo, onOpenMove, onOpenNewPreview, onOpenNewPreviewWithSheet,
  onNotifClick, onMarkAllRead, markingAllRead,
  voltzBalance, onOpenVoltzModal
}) => {
  const notifRef = useRef(null);
  const bellRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Close notif on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (notifRef.current?.contains(e.target)) return;
      if (bellRef.current?.contains(e.target)) return;
      setNotifOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [notifOpen, setNotifOpen]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) return conversations;
    return conversations.filter((c) => {
      const haystack = `${c.name || ""} ${c.role || ""} ${String(c.preview || "").replace(/^You:\s*/, "")}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);

  const filteredNewConnections = useMemo(() => {
    if (!normalizedSearch) return newConnections;
    return newConnections.filter((c) => {
      const haystack = `${c.name || ""} ${c.role || ""} ${c.message || ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [newConnections, normalizedSearch]);

  const visibleConvos = useMemo(() => {
    if (filter === "unread") return filteredConversations.filter(c => c.unread > 0);
    return filteredConversations;
  }, [filter, filteredConversations]);

  const counts = {
    all: conversations.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0),
    unread: conversations.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0),
    new: newConnections.length,
    sent: (sentConnections || []).length,
  };

  const todaysMoves = useMemo(() => {
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return [];
    }

    return conversations.slice(0, 3).map((c, idx) => ({
      id: `mv-${c.id}`,
      convoId: c.id,
      initials: c.initials,
      color: c.color,
      name: c.name,
      role: c.role,
      reason: c.unread > 0
        ? `Unread (${c.unread}) - good time to reply`
        : c.section === "attention"
          ? "No recent activity - good moment to nudge"
          : idx === 0
            ? "Recent momentum - keep the thread warm"
            : "Active conversation - move it forward"
    }));
  }, [conversations]);

  if (notifOpen) {
    // Transform legacy notification format to new format
    const transformedNotifications = notifications.map((n) => ({
      id: n.id || n.initials,
      type: "initials",
      initials: n.initials,
      avatarBg: {
        "red": "#E5484D",
        "orange": "#F97316",
        "amber": "#F5B800",
        "green": "#22B37A",
        "teal": "#14B8A6",
        "blue": "#3B82F6",
        "purple": "#7C6BF2",
        "pink": "#F87171"
      }[n.color] || "#7C6BF2",
      body: n.text || n.body,
      time: n.time || "now",
      draft: false,
      read: false,
    }));

    return (
      <div className="sc-screen sc-screen-inbox" style={{ background: "#FFFFFF" }}>
        <NotificationsPanel
          notifications={transformedNotifications}
          onNotificationPress={onNotifClick}
          onDraftPress={() => {}}
          onMarkAllRead={onMarkAllRead}
          onBack={() => setNotifOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="sc-screen sc-screen-inbox">
      <div className="sc-inbox-header">
        <div className="sc-inbox-title-row">
          <h1 className="sc-inbox-title">Inbox</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div ref={bellRef} style={{ position: "relative" }}>
              <BellButton
                onClick={(e) => { e.stopPropagation(); setNotifOpen(o => !o); }}
                hasPip={notifications.length > 0}
              />
            </div>
            {onOpenVoltzModal && (
              <VoltzWallet balance={voltzBalance ?? 0} onBuyMore={onOpenVoltzModal} />
            )}
          </div>
        </div>
        <Search value={searchQuery} onChange={setSearchQuery} />
      </div>

      <FilterChips active={filter} counts={counts} onChange={onFilter} />
      {!loading && error && <div className="sc-inbox-error">{error}</div>}

      {loading ? (
        <LoadingState />
      ) : filter === "new" ? (
        <NewFeed
          connections={filteredNewConnections}
          onOpen={onOpenNewPreview}
          onReplyAI={onOpenNewPreviewWithSheet}
        />
      ) : filter === "sent" ? (
        <SentFeed connections={sentConnections || []} />
      ) : filter === "unread" && visibleConvos.length === 0 ? (
        <EmptyState>{normalizedSearch ? "No unread matches for your search" : "You're all caught up"}</EmptyState>
      ) : visibleConvos.length === 0 ? (
        <EmptyState>{normalizedSearch ? "No conversations match your search" : "No conversations yet"}</EmptyState>
      ) : (
        <div className="sc-inbox-scroll">
          {filter === "all" && <TodaysMoves onOpenMove={onOpenMove} moves={todaysMoves} />}
          {visibleConvos.map(c => (
            <ConvoRow key={c.id} c={c} onOpen={onOpenConvo} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CHAT — HEADER, THREAD, INPUT
// ============================================================================

const ChatHeader = ({ profile, onBack, onOpenDrawer, activeChip, onChipClick, stageProgress, contextChips }) => (
  <div className="sc-chat-header">
    <div className="sc-chat-header-row">
      <button className="sc-back-btn" onClick={onBack} aria-label="Back">‹</button>
      <div className="sc-chat-header-info">
        <Avatar initials={profile.initials} color={profile.color} size={46} />
        <div className="sc-chat-header-text">
          <div className="sc-chat-name">{profile.name}</div>
          <div className="sc-chat-role">{profile.role}</div>
        </div>
      </div>
      <div className="sc-swipe-hint-hit" role="button" aria-label="Open connection stats" onClick={onOpenDrawer}>
        <div className="sc-swipe-hint">
          <span className="sc-swipe-hint-text">Connection Stats</span>
          <span className="sc-swipe-hint-chev">›</span>
        </div>
      </div>
    </div>

    <div className="sc-progress">
      <div className="sc-progress-track">
        {stageProgress.steps.map((step) => (
          <div key={step.key} className={`sc-progress-seg ${step.done ? "done" : ""}`} />
        ))}
      </div>
      <div className="sc-progress-labels">
        <span>{stageProgress.steps[0]?.label || "Accepted"}</span>
        <span>{stageProgress.current_label || "Pending"}</span>
      </div>
    </div>

    <div className="sc-context-chips">
      {contextChips.map(c => (
        <button
          key={c.key}
          className={`sc-context-chip ${activeChip === c.key ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onChipClick(c.key); }}
        >
          {c.label}
        </button>
      ))}
    </div>
  </div>
);

const Thread = ({ messages, profile, tooltip, onTooltipDismiss, previewMode }) => {
  const threadRef = useRef(null);
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="sc-thread" ref={threadRef} onClick={onTooltipDismiss}>
      {tooltip && <div className="sc-chip-tooltip visible">{tooltip}</div>}
      {messages.map((m, i) => {
        if (m.type === "sep") return <div key={i} className="sc-time-sep">{m.text}</div>;
        if (m.type === "hint") return <div key={i} className="sc-preview-hint">{m.text}</div>;
        if (m.type === "in") {
          return (
            <div key={i} className="sc-msg-group-in">
              <Avatar initials={profile.initials} color={profile.color} size={22} fontSize={9} />
              <div className="sc-bubble-in">{m.text}</div>
            </div>
          );
        }
        return (
          <div key={i} className="sc-bubble-out-wrap">
            <div className="sc-bubble-out">{m.text}</div>
            {!previewMode && (
              <div className={`sc-receipt ${m.read ? "read" : "delivered"}`}>
                {m.read ? "Read" : "Delivered"} · {m.time}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const AIStrip = ({ onOpenSheet, onFillInput }) => (
  <div className="sc-ai-strip">
    <button className="sc-ai-primary" onClick={onOpenSheet}>
      <BoltIcon />
      Confirm time
    </button>
    {AI_SECONDARY_FILLS.map((p, i) => (
      <button key={i} className="sc-ai-secondary" onClick={() => onFillInput(p.fill)}>
        {p.label}
      </button>
    ))}
  </div>
);

const InputBar = ({ value, onChange, onSend, onOpenSheet }) => {
  const hasText = value.trim().length > 0;
  return (
    <div className="sc-input-bar">
      <button className="sc-ai-orb" onClick={onOpenSheet} aria-label="AI assist">
        <BoltIcon />
      </button>
      <div className="sc-input-field">
        <input
          type="text"
          placeholder="Reply..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSend(); } }}
        />
        <div className="sc-input-right">
          <button
            className={`sc-send-btn neutral ${hasText ? "visible active" : ""}`}
            onClick={onSend}
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 13V3M3 7l4-4 4 4" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// AI ASSIST BOTTOM SHEET
// ============================================================================

const AISheet = ({ open, onClose, onUseDraft }) => {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [tone, setTone] = useState("direct");
  const [instruction, setInstruction] = useState("");

  return (
    <>
      <div className={`sc-sheet-overlay ${open ? "visible" : ""}`} onClick={onClose} />
      <div className={`sc-sheet ${open ? "visible" : ""}`}>
        <div className="sc-sheet-handle" />

        <div className="sc-sheet-label">Suggested draft</div>
        <textarea
          className="sc-sheet-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="sc-sheet-hint">AI drafted from your profile and conversation context</div>

        <div className="sc-sheet-label" style={{ marginTop: 20 }}>Tone</div>
        <div className="sc-tone-row">
          {TONE_OPTIONS.map(t => (
            <button
              key={t}
              className={`sc-tone-chip ${t} ${tone === t ? "active" : ""}`}
              onClick={() => setTone(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="sc-sheet-label" style={{ marginTop: 20 }}>Or tell the AI what to say</div>
        <input
          className="sc-tell-input"
          placeholder="e.g. suggest we meet next week"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />

        <button className="sc-btn-outline" onClick={() => {/* placeholder */}}>Regenerate</button>
        <button className="sc-btn-filled" onClick={() => onUseDraft(draft)}>Use this draft</button>
      </div>
    </>
  );
};

// ============================================================================
// CONTEXT DRAWER
// ============================================================================

const DrawerSection = ({ label, children, withDivider = false, style }) => (
  <div className={`sc-drawer-section ${withDivider ? "with-divider" : ""}`} style={style}>
    {label && <div className="sc-drawer-label">{label}</div>}
    {children}
  </div>
);

const BreakdownBar = ({ dim, label, value }) => (
  <div className="sc-breakdown-row" data-dim={dim}>
    <span className="sc-breakdown-label">{label}</span>
    <div className="sc-breakdown-track">
      <div className="sc-breakdown-fill" style={{ width: `${value}%` }} />
    </div>
    <span className="sc-breakdown-val">{value}</span>
  </div>
);

const RelationshipChart = ({ series }) => {
  const safeSeries = normalizeRelationshipStrengthSeries(series).slice(-24);
  const chartPoints = safeSeries.map((point, index) => ({
    ...point,
    ms: new Date(point.at).getTime(),
    key: `${point.at}-${index}`,
  }));

  const minX = 20;
  const maxX = 260;
  const minY = 18;
  const maxY = 70;
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const minMs = chartPoints[0]?.ms ?? 0;
  const maxMs = chartPoints[chartPoints.length - 1]?.ms ?? minMs;
  const rangeMs = Math.max(1, maxMs - minMs);

  const projected = chartPoints.map((point) => {
    const x = chartPoints.length === 1
      ? minX + (spanX / 2)
      : minX + (((point.ms - minMs) / rangeMs) * spanX);
    const y = maxY - ((clampPct(point.score, 0) / 100) * spanY);
    return { ...point, x, y };
  });

  const linePath = projected
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const first = projected[0];
  const last = projected[projected.length - 1];
  const areaPath = first && last
    ? `${linePath} L ${last.x.toFixed(2)} ${maxY} L ${first.x.toFixed(2)} ${maxY} Z`
    : "";

  const maxLabels = 5;
  const labelIndexes = (() => {
    if (projected.length <= maxLabels) return projected.map((_, index) => index);
    const picks = [0];
    for (let i = 1; i < maxLabels - 1; i += 1) {
      picks.push(Math.round((i * (projected.length - 1)) / (maxLabels - 1)));
    }
    picks.push(projected.length - 1);
    return [...new Set(picks)];
  })();

  return (
    <div className="sc-rel-chart">
      <svg viewBox="0 0 280 90" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8A94A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#E8A94A" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={minX} y1="56" x2={maxX} y2="56" stroke="rgba(232,169,74,0.2)" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={minX} y1="42" x2={maxX} y2="42" stroke="rgba(61,170,130,0.2)" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={minX} y1="28" x2={maxX} y2="28" stroke="rgba(91,140,245,0.2)" strokeWidth="0.5" strokeDasharray="3,3" />

        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
        {linePath && <path d={linePath} stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none" />}

        {projected.map((point, index) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={index === projected.length - 1 ? 4 : 2.8}
            fill={index === projected.length - 1 ? "#1A1A1A" : "#5B8CF5"}
          />
        ))}

        {last && (
          <text
            x={last.x}
            y={Math.max(12, last.y - 8)}
            fill="#1A1A1A"
            fontFamily="DM Sans, sans-serif"
            fontSize="10"
            fontWeight="600"
            textAnchor="middle"
          >
            {Math.round(last.score)}
          </text>
        )}

        {labelIndexes.map((idx) => {
          const point = projected[idx];
          return (
            <text
              key={`label-${point.key}`}
              x={point.x}
              y="84"
              fill="#AFAFAF"
              fontFamily="DM Sans, sans-serif"
              fontSize="9"
              textAnchor="middle"
            >
              {formatChartDate(point.at)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

const Milestone = ({ status, label, date }) => {
  const color = status === "done" ? "#22A85A" : status === "pending" ? "#9B7CF6" : "#AFAFAF";
  const bg = status === "done" ? "#EAF5EF" : status === "pending" ? "#F0EDF8" : "#F5F3F0";
  return (
    <div className="sc-milestone">
      <div className="sc-milestone-icon" style={{ background: bg }}>
        {status === "done" ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke={color} strokeWidth="1.5"/></svg>
        )}
      </div>
      <span className={`sc-milestone-label ${status}`}>{label}</span>
      <span className="sc-milestone-date">{date}</span>
    </div>
  );
};

const ContextDrawer = ({ open, onClose, profile, voltz, relationshipContext }) => {
  const stageProgress = relationshipContext?.stageProgress || DEFAULT_RELATIONSHIP_CONTEXT.stageProgress;
  const stageLabel = stageProgress.current_label || "Pending";
  const summary = relationshipContext?.summary || DEFAULT_RELATIONSHIP_CONTEXT.summary;
  const score = relationshipContext?.score ?? DEFAULT_RELATIONSHIP_CONTEXT.score;
  const breakdown = relationshipContext?.breakdown || DEFAULT_RELATIONSHIP_CONTEXT.breakdown;
  const exchangeCount = relationshipContext?.exchangeCount ?? 0;
  const responseRate = relationshipContext?.responseRate ?? 0;
  const lastContact = formatRelativeLastContact(relationshipContext?.lastContactAt);
  const connectionVoltz = Number.isFinite(Number(relationshipContext?.voltzEarned))
    ? Number(relationshipContext.voltzEarned)
    : voltz;
  const events = Array.isArray(relationshipContext?.events) ? relationshipContext.events : [];
  const relationshipSeries = normalizeRelationshipStrengthSeries(relationshipContext?.relationshipStrengthSeries);
  const recentEvents = events.slice(0, 3);

  const eventDateMap = new Map(events.map((evt) => [evt.event_type, formatEventDate(evt.occurred_at)]));
  const timelineRows = recentEvents.length > 0
    ? recentEvents.map((evt) => ({
        color: eventDotColor(evt.event_type),
        label: EVENT_LABELS[evt.event_type] || evt.event_type,
        date: formatEventDate(evt.occurred_at),
      }))
    : [];

  const signalRows = relationshipContext?.chips?.map((chip) => ({
    color: signalColorForChipKey(chip.key),
    label: chip.label,
  })) || [];

  return (
    <>
    <div className={`sc-drawer-overlay ${open ? "visible" : ""}`} onClick={onClose} />
    <div className={`sc-drawer ${open ? "visible" : ""}`}>
      <div className="sc-drawer-header">
        <button className="sc-drawer-back" onClick={onClose} aria-label="Close">‹</button>
        <Avatar initials={profile.initials} color={profile.color} size={40} fontSize={14} />
        <div>
          <div className="sc-drawer-name">{profile.name}</div>
          <div className="sc-drawer-role">{profile.role}</div>
        </div>
      </div>

      <div className="sc-drawer-scroll">

        <DrawerSection label="Match">
          <div className="sc-match-summary">
            {summary}
          </div>
          <div className="sc-stage-pill-wrap"><span className="sc-stage-pill-lg">{stageLabel}</span></div>
        </DrawerSection>

        <DrawerSection label="Relationship strength" withDivider>
          <div className="sc-rel-number">{score}</div>
          <div className="sc-rel-status">{stageLabel}</div>
          <div className="sc-rel-submetrics">
            <div>
              <span className="sc-rel-metric-label">Last contact</span>
              <span className="sc-rel-metric-value">{lastContact}</span>
            </div>
            <div>
              <span className="sc-rel-metric-label">Exchanges</span>
              <span className="sc-rel-metric-value">{exchangeCount}</span>
            </div>
            <div>
              <span className="sc-rel-metric-label">Response rate</span>
              <span className="sc-rel-metric-value">{responseRate}%</span>
            </div>
          </div>
          <div className="sc-voltz-line">
            This relationship has earned you <strong>{connectionVoltz} voltz</strong>
          </div>
        </DrawerSection>

        <DrawerSection label="Breakdown">
          <BreakdownBar dim="background" label="Background" value={breakdown.background} />
          <BreakdownBar dim="goals"      label="Goals"      value={breakdown.goals} />
          <BreakdownBar dim="network"    label="Network fit" value={breakdown.network} />
          <BreakdownBar dim="stage"      label="Stage align" value={breakdown.stage} />
        </DrawerSection>

        <DrawerSection label="Relationship over time">
          <RelationshipChart series={relationshipSeries} />
          {timelineRows.length === 0 ? (
            <div className="sc-rel-empty">No relationship events yet.</div>
          ) : (
            <div className="sc-rel-transitions">
              {timelineRows.map((row, i) => (
                <span key={`${row.label}-${i}`} className="sc-rel-transition"><span className="sc-rel-transition-dot" style={{ background: row.color }} />{row.label} - {row.date}</span>
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection label="Signals">
          {signalRows.length === 0 ? (
            <div className="sc-rel-empty">No live signals yet.</div>
          ) : (
            <div className="sc-drawer-signals-grid">
              {signalRows.map((row, index) => (
                <div key={`${row.label}-${index}`} className="sc-drawer-signal-item">
                  <span className="sc-drawer-signal-dot" style={{ background: row.color }} />{row.label}
                </div>
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection label="Outreach">
          {timelineRows.length === 0 ? (
            <div className="sc-rel-empty">No outreach activity recorded yet.</div>
          ) : (
            timelineRows.map((row, i) => (
              <div key={`${row.label}-${i}`} className="sc-timeline-item">
                <div className="sc-timeline-left">
                  <div className="sc-timeline-dot" style={{ background: row.color }} />
                  <div className="sc-timeline-line" />
                </div>
                <div className="sc-timeline-content">
                  <div className="sc-timeline-label">{row.label}</div>
                  <div className="sc-timeline-date">{row.date}</div>
                </div>
              </div>
            ))
          )}
        </DrawerSection>

        <DrawerSection label="Relationship">
          <Milestone status="done" label="Cold outreach sent" date={eventDateMap.get("outreach_sent") || "-"} />
          <Milestone status={milestoneStatus(stageProgress, "first_reply")} label="First reply received" date={eventDateMap.get("first_reply") || eventDateMap.get("message_sent") || "-"} />
          <Milestone status={milestoneStatus(stageProgress, "call_booked")} label="Call booked" date={eventDateMap.get("call_booked") || "-"} />
          <Milestone status={milestoneStatus(stageProgress, "coffee_done")} label="Coffee done" date={eventDateMap.get("coffee_done") || "-"} />
          <Milestone status={milestoneStatus(stageProgress, "introduction_made")} label="Introduction made" date={eventDateMap.get("introduction_made") || "-"} />
        </DrawerSection>

        <DrawerSection label="Notes">
          <div className="sc-rel-empty">No notes yet.</div>
        </DrawerSection>

      </div>
    </div>
    </>
  );
};

// ============================================================================
// PREVIEW / REQUEST BARS
// ============================================================================

const PreviewBanner = () => (
  <div className="sc-preview-banner">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49B0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
    <span className="sc-preview-banner-text">
      They can't see you've opened this yet. Accept to start the conversation.
    </span>
  </div>
);

const RequestBar = ({ onAccept, onDecline, declined, onUndo }) => {
  if (declined) {
    return (
      <div className="sc-decline-confirm">
        <span className="sc-decline-confirm-text">Removed from new connections</span>
        <button className="sc-decline-undo" onClick={onUndo}>Undo</button>
      </div>
    );
  }
  return (
    <div className="sc-request-bar">
      <button className="sc-btn-decline" onClick={onDecline}>Decline</button>
      <button className="sc-btn-accept" onClick={onAccept}>Accept</button>
    </div>
  );
};

// ============================================================================
// VOLTZ TOAST
// ============================================================================

const VoltzToast = ({ amount, visible }) => (
  <div className={`sc-voltz-toast ${visible ? "visible" : ""}`}>
    <BoltIcon strokeColor="#FFFEFD" />
    <span>+{amount} voltz</span>
  </div>
);

// ============================================================================
// CHAT (assembled)
// ============================================================================

const Chat = ({
  active, profile, messages, onBack,
  activeChip, onChipClick, tooltip, onTooltipDismiss,
  stageProgress, contextChips,
  input, setInput,
  onSend, onOpenSheet, onFillInput,
  drawerOpen, setDrawerOpen,
  sheetOpen, onCloseSheet, onUseDraft,
  voltzToast,
  previewMode, onAccept, onDecline, declined, onUndo,
  voltz, relationshipContext
}) => (
  <div className={`sc-screen sc-screen-chat ${active ? "active" : ""} ${previewMode ? "preview" : ""}`}>
    <VoltzToast amount={voltzToast.amount} visible={voltzToast.visible} />

    <ChatHeader
      profile={profile}
      onBack={onBack}
      onOpenDrawer={() => setDrawerOpen(true)}
      activeChip={activeChip}
      onChipClick={onChipClick}
      stageProgress={stageProgress}
      contextChips={contextChips}
    />

    {previewMode && <PreviewBanner />}

    <Thread
      messages={messages}
      profile={profile}
      tooltip={tooltip}
      onTooltipDismiss={onTooltipDismiss}
      previewMode={previewMode}
    />

    {previewMode ? (
      <RequestBar
        onAccept={onAccept}
        onDecline={onDecline}
        declined={declined}
        onUndo={onUndo}
      />
    ) : (
      <>
        <AIStrip onOpenSheet={onOpenSheet} onFillInput={onFillInput} />
        <InputBar
          value={input}
          onChange={setInput}
          onSend={onSend}
          onOpenSheet={onOpenSheet}
        />
      </>
    )}

    <AISheet open={sheetOpen} onClose={onCloseSheet} onUseDraft={onUseDraft} />
    <ContextDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      profile={profile}
      voltz={voltz}
      relationshipContext={relationshipContext}
    />
  </div>
);

// ============================================================================
// ROOT
// ============================================================================

export default function SuperchargedInbox({ currentUserProfile = null, voltzBalance = 0, onOpenVoltzModal }) {
  // --- data state ---
  const [conversations, setConversations] = useState([]);
  const [newConnections, setNewConnections] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(HAS_BACKEND_GATEWAYS);
  const [inboxError, setInboxError] = useState(null);
  const [hasHydratedInbox, setHasHydratedInbox] = useState(false);
  const [backendProfile, setBackendProfile] = useState(currentUserProfile || null);
  const [backendReady, setBackendReady] = useState(HAS_BACKEND_GATEWAYS);

  // --- navigation state ---
  const [filter, setFilter] = useState("all");
  const [chatActive, setChatActive] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // --- chat state ---
  const SARAH_PROFILE = { initials: "SC", color: AVATAR_COLORS.purple, name: "Sarah Chen", role: "VC Associate · Sequoia", id: "sarah" };
  const [chatProfile, setChatProfile] = useState(SARAH_PROFILE);
  const [messages, setMessages] = useState(SARAH_MESSAGES);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeChip, setActiveChip] = useState(null);
  const [input, setInput] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nextSendFromDraft, setNextSendFromDraft] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [relationshipContext, setRelationshipContext] = useState(() => getDefaultRelationshipContext());

  // --- preview state ---
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCardId, setPreviewCardId] = useState(null);
  const [declined, setDeclined] = useState(false);
  const declineTimerRef = useRef(null);

  // --- sent connections ---
  const [sentConnections, setSentConnections] = useState([]);

  // --- voltz ---
  const [voltzTotal, setVoltzTotal] = useState(43);
  const [voltzToast, setVoltzToast] = useState({ visible: false, amount: 0 });
  const toastTimerRef = useRef(null);
  const queueRef = useRef([]);
  const queueProcessingRef = useRef(false);

  const executeFunction = useCallback(async (functionId, payload) => {
    const execution = await functions.createExecution(functionId, JSON.stringify(payload), false);
    const body = JSON.parse(execution.responseBody || "{}");
    if (body?.error) throw new Error(body.error);
    return body;
  }, []);

  const buildLiveNotifications = useCallback((liveConversations, livePending) => {
    const unreadNotifications = liveConversations
      .filter((c) => c.unread > 0)
      .sort((a, b) => b.unread - a.unread)
      .map((c) => ({
        id: `notif-unread-${c.id}`,
        kind: NOTIF_KIND_UNREAD,
        initials: c.initials,
        color: c.color,
        text: `${c.name} sent ${c.unread} new message${c.unread === 1 ? "" : "s"}.`,
        time: c.timestamp,
        conversationId: c.id,
      }));

    const attentionNotifications = liveConversations
      .filter((c) => c.section === "attention" && c.unread === 0)
      .map((c) => ({
        id: `notif-attention-${c.id}`,
        kind: NOTIF_KIND_ATTENTION,
        initials: c.initials,
        color: c.color,
        text: `${c.name} may need a nudge - ${String(c.preview || "").replace(/^You:\s*/, "")}`,
        time: c.timestamp,
        conversationId: c.id,
      }));

    const pendingNotifications = livePending.map((c) => ({
      id: `notif-pending-${c.id}`,
      kind: NOTIF_KIND_PENDING,
      initials: c.initials,
      color: c.color,
      text: `${c.name} sent you a connection request.`,
      time: "Now",
      connectionId: c.connectionId || c.id,
    }));

    return [...unreadNotifications, ...pendingNotifications, ...attentionNotifications].slice(0, 12);
  }, []);

  const showToast = useCallback((amount) => {
    setVoltzToast({ visible: true, amount });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setVoltzToast((t) => ({ ...t, visible: false }));
    }, 2600);
  }, []);

  const awardVoltzAmount = useCallback((amount) => {
    if (!amount) return;
    setVoltzTotal((v) => v + amount);
    queueRef.current.push(amount);
    if (!queueProcessingRef.current) {
      queueProcessingRef.current = true;
      const drain = () => {
        const next = queueRef.current.shift();
        if (next === undefined) {
          queueProcessingRef.current = false;
          return;
        }
        showToast(next);
        setTimeout(drain, 900);
      };
      drain();
    }
  }, [showToast]);

  const earnVoltz = useCallback((key) => {
    const amount = VOLTZ_EVENTS[key];
    if (!amount) return;
    awardVoltzAmount(amount);
  }, [awardVoltzAmount]);

  const resolveCurrentProfile = useCallback(async () => {
    if (currentUserProfile?.$id) {
      setBackendProfile((prev) => (prev?.$id === currentUserProfile.$id ? prev : currentUserProfile));
      return currentUserProfile;
    }

    try {
      const user = await account.get();
      const cached = readCacheEntry(`supercharged:profile:v1:${user.$id}`, PROFILE_CACHE_TTL_MS);
      if (cached?.data?.row) {
        setBackendProfile((prev) => (prev?.$id === cached.data.row.$id ? prev : cached.data.row));
        return cached.data.row;
      }

      const found = await tables.listRows({
        databaseId: DB_ID,
        tableId: PROFILES_TABLE,
        queries: [Query.equal("user_id", user.$id), Query.limit(1)],
      });
      const profile = found.rows?.[0] || null;
      setBackendProfile((prev) => (prev?.$id === profile?.$id ? prev : profile));
      return profile;
    } catch {
      return null;
    }
  }, [currentUserProfile]);

  const loadConversationMessages = useCallback(async (conversationId, profileId) => {
    if (!backendReady || !conversationId || !profileId) return false;

    const cacheKey = THREAD_CACHE_KEY(profileId, conversationId);
    const cached = readCacheEntry(cacheKey, THREAD_CACHE_TTL_MS);
    if (cached?.data?.messages) {
      setMessages(cached.data.messages);
      if (Date.now() - (cached.savedAt || 0) < 30 * 1000) {
        return true;
      }
    }

    const fetchMessages = async () => {
      const data = await executeFunction(MESSAGE_GATEWAY_FUNCTION_ID, {
        action: "list_messages",
        conversation_id: conversationId,
        limit: 100,
      });

      const mapped = mapMessagesToThread(data.messages || [], profileId);
      const nextMessages = mapped.length > 0 ? mapped : [{ type: "sep", text: "No messages yet" }];
      setMessages(nextMessages);
      writeCacheEntry(cacheKey, { messages: nextMessages });

      // Fire mark-read in background — don't block the chat opening
      executeFunction(MESSAGE_GATEWAY_FUNCTION_ID, {
        action: "mark_conversation_read",
        conversation_id: conversationId,
      }).catch(err => console.warn('mark_read background:', err));
    };

    if (cached?.data?.messages) {
      fetchMessages().catch((err) => {
        console.error("Conversation refresh failed:", err);
      });
      return true;
    }

    await fetchMessages();

    return true;
  }, [backendReady, executeFunction]);

  const hydrateRelationshipContext = useCallback(async (connectionId) => {
    if (!connectionId) {
      setRelationshipContext(getDefaultRelationshipContext());
      return null;
    }

    if (!backendReady) {
      setRelationshipContext(getDefaultRelationshipContext());
      return null;
    }

    const out = await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
      action: "get_connection",
      connection_id: connectionId,
    });

    setRelationshipContext(buildRelationshipContext(out));
    return out;
  }, [backendReady, executeFunction]);

  const refreshInboxData = useCallback(async (profileOverride = null, options = {}) => {
    const { showLoading = false, forceRefresh = false } = options;
    if (!backendReady) {
      setInboxLoading(false);
      return;
    }

    const profile = profileOverride || backendProfile;
    if (!profile?.$id) {
      setInboxLoading(false);
      return;
    }

    if (showLoading || !hasHydratedInbox) {
      setInboxLoading(true);
    }
    setInboxError(null);

    const cacheKey = INBOX_CACHE_KEY(profile.$id);
    const cached = readCacheEntry(cacheKey, 15 * 60 * 1000);
    if (cached?.data) {
      const { conversations: cachedConversations = [], newConnections: cachedNewConnections = [], notifications: cachedNotifications = [] } = cached.data;
      setConversations(cachedConversations);
      setNewConnections(cachedNewConnections);
      setNotifications(cachedNotifications);
      setHasHydratedInbox(true);
      setInboxLoading(false);
      if (!forceRefresh && Date.now() - (cached.savedAt || 0) < INBOX_CACHE_TTL_MS) {
        return true;
      }
    }

    try {
      let activeData;
      let pendingData;

      // Fetch sent connections in parallel with everything else
      const sentDataPromise = executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: "list_pending_from_me",
        limit: 50,
      }).catch(() => ({ connections: [] }));

      try {
        const bootstrapData = await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
          action: "bootstrap_inbox",
          limit: 80,
        });

        activeData = { conversations: Array.isArray(bootstrapData?.conversations) ? bootstrapData.conversations : [] };
        pendingData = { connections: Array.isArray(bootstrapData?.pending) ? bootstrapData.pending : [] };
      } catch (bootstrapErr) {
        const bootstrapMessage = String(bootstrapErr?.message || "");
        const canFallback = /Unknown action|not found/i.test(bootstrapMessage);
        if (!canFallback) throw bootstrapErr;

        [activeData, pendingData] = await Promise.all([
          executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
            action: "list_active",
            limit: 80,
          }),
          executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
            action: "list_pending_to_me",
            limit: 80,
          }),
        ]);
      }

      const sentData = await sentDataPromise;
      const mappedSent = (sentData?.connections || []).map(mapSentConnectionFromBackend).filter(Boolean);
      setSentConnections(mappedSent);

      const mappedConversations = (activeData?.conversations || [])
        .map(mapConversationFromBackend)
        .filter(Boolean);
      if (mappedConversations.length > 0) {
        setConversations(mappedConversations);
      } else {
        setConversations([]);
      }

      const activeIds = new Set(mappedConversations.map(c => c.id));
      const mappedPending = (pendingData?.connections || [])
        .map(mapNewConnectionFromBackend)
        .filter(Boolean)
        .filter(c => !activeIds.has(c.id));
      setNewConnections(mappedPending);

      const nextNotifications = buildLiveNotifications(mappedConversations, mappedPending);
      setNotifications(nextNotifications);
      setHasHydratedInbox(true);
      writeCacheEntry(cacheKey, {
        conversations: mappedConversations,
        newConnections: mappedPending,
        notifications: nextNotifications,
      });
    } catch (err) {
      console.error("Inbox backend sync failed:", err);
      setInboxError("Unable to refresh inbox right now.");
      if (/not found|Unknown action|Function/i.test(String(err?.message || ""))) {
        setBackendReady(false);
      }
      setHasHydratedInbox(true);
      setConversations([]);
      setNewConnections([]);
      setNotifications([]);
    } finally {
      setInboxLoading(false);
    }
  }, [backendReady, backendProfile, executeFunction, buildLiveNotifications, hasHydratedInbox]);

  useEffect(() => {
    let isMounted = true;

    const hydrateInbox = async () => {
      if (!backendReady) {
        if (isMounted) {
          setInboxLoading(false);
          setHasHydratedInbox(true);
        }
        return;
      }

      const profile = await resolveCurrentProfile();
      if (!isMounted) return;

      if (!profile?.$id) {
        setInboxLoading(false);
        setHasHydratedInbox(true);
        setInboxError("Could not resolve your profile.");
        return;
      }

      await refreshInboxData(profile, { showLoading: true });
    };

    hydrateInbox();

    return () => {
      isMounted = false;
    };
  }, [resolveCurrentProfile, refreshInboxData, backendReady]);

  useEffect(() => {
    if (!backendReady || !backendProfile?.$id) return undefined;

    const timer = setInterval(() => {
      refreshInboxDataRef.current(null, { showLoading: false }).catch((err) => {
        console.error("Inbox poll refresh failed:", err);
      });
    }, 30000);

    return () => clearInterval(timer);
  }, [backendReady, backendProfile]); // refreshInboxData removed from deps

  useEffect(() => () => {
    clearTimeout(toastTimerRef.current);
    clearTimeout(declineTimerRef.current);
  }, []);

  // Keep a stable ref to refreshInboxData so the global realtime listener
  // doesn't re-subscribe every time the callback reference changes.
  const refreshInboxDataRef = useRef(refreshInboxData);
  useEffect(() => {
    refreshInboxDataRef.current = refreshInboxData;
  }, [refreshInboxData]);

  // Appwrite Realtime: Global listener for inbox updates
  // Uses tablesdb.* channel prefix (TablesDB API) not databases.* (legacy Collections).
  useEffect(() => {
    if (!backendProfile?.$id) return;

    const profileId = backendProfile.$id;
    console.log('[Inbox Realtime] backendProfile:', {
      $id: backendProfile.$id,
      user_id: backendProfile.user_id,
      name: backendProfile.name,
    });
    const channels = [
      `tablesdb.${DB_ID}.tables.inbox_notifications.rows`,
      `tablesdb.${DB_ID}.tables.connections.rows`,
    ];
    console.log('[Inbox Realtime] Subscribing to channels:', channels);

    let unsubscribe;
    const initRealtime = async () => {
      try {
        console.log('[Inbox Realtime] Calling realtime.subscribe...');
        unsubscribe = await realtime.subscribe(channels, (response) => {
          console.log('[Inbox Realtime] EVENT RECEIVED:', response);
          const isCreate = response.events?.some(e => e.endsWith('.create'));
          const isUpdate = response.events?.some(e => e.endsWith('.update'));
          console.log('[Inbox Realtime]', {
            events: response.events,
            isCreate,
            isUpdate,
            payloadConversationId: response.payload?.conversation_id,
            payloadSenderName: response.payload?.sender_name,
            payloadPreview: response.payload?.message_preview?.slice(0, 50),
          });
          if (!isCreate && !isUpdate) {
            console.log('[Inbox Realtime] Ignoring non-create/update event');
            return;
          }

          // Optimistic update — show new message preview immediately
          if (isCreate && response.payload?.conversation_id) {
            const cid = response.payload.conversation_id;
            console.log(`[Inbox Realtime] Optimistic update for conversation ${cid}`);
            setConversations((prev) => {
              const updated = prev.map((c) => {
                const isMatch = (c.conversationId || c.id) === cid;
                if (isMatch) {
                  console.log(`[Inbox Realtime] Matched conversation, updating preview from "${c.lastMessage?.slice(0, 30)}" to "${response.payload.message_preview?.slice(0, 30)}"`);
                  return {
                    ...c,
                    lastMessage: response.payload.message_preview || c.lastMessage,
                    unreadCount: (c.unreadCount || 0) + 1,
                  };
                }
                return c;
              });
              return updated;
            });
          } else if (isCreate) {
            console.log('[Inbox Realtime] Create event but no conversation_id in payload');
          }

          removeCacheEntry(INBOX_CACHE_KEY(profileId));
          console.log('[Inbox Realtime] Invalidated cache, starting full refresh');
          refreshInboxDataRef.current(null, { forceRefresh: true })
            .catch(err => console.warn('Global realtime inbox refresh err:', err));
        });
        console.log('[Inbox Realtime] Subscription successful, listener active');
      } catch (err) {
        console.error('[Inbox Realtime] Failed to subscribe:', err);
      }
    };

    initRealtime();
    return () => {
      console.log('[Inbox Realtime] Cleaning up subscription');
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      } else if (unsubscribe?.unsubscribe) {
        unsubscribe.unsubscribe();
      }
    };
  }, [backendProfile, DB_ID]);

  // Fallback: More aggressive polling when inbox is active (realtime may not capture all new messages due to access control scoping)
  useEffect(() => {
    if (!backendReady || !backendProfile?.$id || chatActive) return undefined;
    const timer = setInterval(() => {
      refreshInboxDataRef.current(null, { showLoading: false }).catch((err) => {
        console.warn('Fallback inbox poll failed:', err);
      });
    }, 8000); // Poll every 8s when in inbox (vs 30s when inactive)
    return () => clearInterval(timer);
  }, [backendReady, backendProfile, chatActive]);

  // Appwrite Realtime: push new messages into the open conversation without polling
  // Uses tablesdb.* channel prefix (TablesDB API) not databases.* (legacy Collections).
  useEffect(() => {
    if (!activeConversationId || !backendProfile?.$id) return;

    const channel = `tablesdb.${DB_ID}.tables.messages.rows`;
    let unsubscribe;
    const initChatRealtime = async () => {
      try {
        unsubscribe = await realtime.subscribe(channel, (response) => {
          const isCreate = response.events?.some(e => e.endsWith('.create'));
          const isUpdate = response.events?.some(e => e.endsWith('.update'));
          
          if (!isCreate && !isUpdate) return;
          
          const doc = response.payload;
          const docConvId = typeof doc.conversation === 'string' ? doc.conversation : doc.conversation?.$id;
          if (docConvId !== activeConversationId) return;
          
          const senderId = typeof doc.sender === 'string' ? doc.sender : doc.sender?.$id;
          const isOutgoing = senderId === backendProfile.$id;
          const sentAt = doc.sent_at || new Date().toISOString();

          if (isCreate) {
            setMessages(prev => {
              if (prev.some(m => m.id === doc.$id)) return prev;
              const newMsg = isOutgoing
                ? { id: doc.$id, type: 'out', text: doc.body, time: formatChatTime(sentAt), read: doc.delivery_status === 'read' }
                : { id: doc.$id, type: 'in', text: doc.body };
              return [...prev, newMsg];
            });

            // Automatically mark incoming messages as read if we have the chat open
            if (!isOutgoing) {
              executeFunction(MESSAGE_GATEWAY_FUNCTION_ID, {
                action: "mark_conversation_read",
                conversation_id: activeConversationId,
              }).catch(err => console.warn('Realtime mark read err:', err));
            }
          } else if (isUpdate) {
            // Handle read receipts
            setMessages(prev => prev.map(m => {
              if (m.id === doc.$id && m.type === 'out') {
                return { ...m, read: doc.delivery_status === 'read' };
              }
              return m;
            }));
          }
        });
      } catch (err) {
        console.error('Failed to subscribe to chat realtime:', err);
      }
    };

    initChatRealtime();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      } else if (unsubscribe?.unsubscribe) {
        unsubscribe.unsubscribe();
      }
    };
  }, [activeConversationId, backendProfile, DB_ID]);

  // --- handlers ---
  const openChat = () => { setChatActive(true); };
  const closeChat = () => {
    console.log('[closeChat] Closing chat and refreshing inbox');
    setChatActive(false);
    setDrawerOpen(false);
    setSheetOpen(false);
    setActiveConversationId(null);
    refreshInboxData(null, { showLoading: false, forceRefresh: true }).catch((err) => {
      console.error('[closeChat] Inbox refresh failed:', err);
    });
    setTimeout(() => {
      if (previewMode) {
        setPreviewMode(false);
        setDeclined(false);
        setChatProfile(SARAH_PROFILE);
        setMessages(SARAH_MESSAGES);
        setPreviewCardId(null);
        setRelationshipContext(getDefaultRelationshipContext());
      }
    }, 450);
  };

  const handleOpenConvo = async (id) => {
    const convo = conversations.find((x) => x.id === id);
    if (!convo) return;

    setChatProfile({ initials: convo.initials, color: convo.color, name: convo.name, role: convo.role, id: convo.id });
    setPreviewMode(false);
    setDeclined(false);
    setPreviewCardId(null);

    const conversationId = convo.conversationId || convo.id;
    const connectionId = convo.connectionId || null;
    setActiveConversationId(conversationId);

    if (connectionId) {
      hydrateRelationshipContext(connectionId).catch((err) => {
        console.error("Failed loading connection context:", err);
      });
    } else if (convo.compatibilitySnapshot || convo.compatibilityScoreSnapshot) {
      setRelationshipContext(buildRelationshipContext({
        connection: {
          status: "accepted",
          compatibility_snapshot: convo.compatibilitySnapshot || null,
          compatibility_score_snapshot: convo.compatibilityScoreSnapshot || null,
        },
      }));
    } else {
      setRelationshipContext(getDefaultRelationshipContext());
    }

    // Open the chat panel immediately — messages fill in after
    openChat();

    if (backendReady && backendProfile?.$id && conversationId) {
      setMessages([{ type: "sep", text: "Loading conversation..." }]);
      loadConversationMessages(conversationId, backendProfile.$id).catch(err => {
        console.error("Failed loading conversation messages:", err);
        setMessages(SARAH_MESSAGES);
      });
    } else {
      setMessages(SARAH_MESSAGES);
    }
  };

  const handleOpenMove = (convoId, alsoOpenSheet) => {
    handleOpenConvo(convoId);
    if (alsoOpenSheet) setTimeout(() => setSheetOpen(true), 400);
  };

  const handleNotifClick = (n) => {
    setNotifOpen(false);

    if (n.kind === NOTIF_KIND_PENDING) {
      const connectionId = n.connectionId || n.id;
      const pending = newConnections.find((conn) => (conn.connectionId || conn.id) === connectionId);
      if (pending) {
        enterPreview(pending, true);
      }
      return;
    }

    const convoId = n.conversationId || conversations.find((c) => c.initials === n.initials)?.id || conversations[0]?.id;
    if (convoId) handleOpenConvo(convoId);
    setTimeout(() => setSheetOpen(true), 400);
  };

  const handleMarkAllRead = async () => {
    if (markingAllRead) return;

    const unreadConversationIds = [...new Set(
      notifications
        .filter((n) => n.kind === NOTIF_KIND_UNREAD && n.conversationId)
        .map((n) => n.conversationId)
    )];

    if (!backendReady || !backendProfile?.$id) {
      setNotifications((items) => items.filter((n) => n.kind !== NOTIF_KIND_UNREAD));
      return;
    }

    setMarkingAllRead(true);
    try {
      await Promise.allSettled(
        unreadConversationIds.map((conversationId) => executeFunction(MESSAGE_GATEWAY_FUNCTION_ID, {
          action: "mark_conversation_read",
          conversation_id: conversationId,
        }))
      );
      await refreshInboxData();
    } finally {
      setMarkingAllRead(false);
    }
  };

  const enterPreview = (conn, alsoOpenSheet) => {
    setChatProfile({ initials: conn.initials, color: conn.color, name: conn.name, role: conn.role, id: conn.id });
    setMessages([
      { type: "sep", text: "Earlier today" },
      { type: "in", text: conn.message },
      { type: "hint", text: "You haven't replied yet" }
    ]);
    setPreviewMode(true);
    setDeclined(false);
    setPreviewCardId(conn.connectionId || conn.id);
    setActiveConversationId(null);

    const previewConnectionId = conn.connectionId || conn.id;
    if (previewConnectionId && backendReady) {
      hydrateRelationshipContext(previewConnectionId).catch((err) => {
        console.error("Failed loading preview context:", err);
      });
    } else {
      setRelationshipContext(getDefaultRelationshipContext());
    }

    openChat();
    if (alsoOpenSheet) setTimeout(() => setSheetOpen(true), 400);
  };

  const handleAccept = async () => {
    if (isActionBusy) return;

    setPreviewMode(false);
    setMessages((ms) => {
      const withoutHint = ms.filter((m) => m.type !== "hint");
      return [...withoutHint, { type: "sep", text: "Conversation accepted · Just now" }];
    });

    if (!previewCardId) return;

    const acceptedConnectionId = previewCardId;
    setIsActionBusy(true);
    try {
      if (backendReady && backendProfile?.$id) {
        const out = await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
          action: "accept_connection",
          connection_id: acceptedConnectionId,
        });

        if (out?.compatibility_snapshot || out?.stage_progress) {
          setRelationshipContext(buildRelationshipContext({
            connection: {
              id: acceptedConnectionId,
              status: "accepted",
              compatibility_snapshot: out.compatibility_snapshot || null,
              compatibility_score_snapshot: out.compatibility_snapshot?.score || null,
            },
            metrics: {
              current_stage: out.stage_progress?.current_stage || "accepted",
              stage_progress: out.stage_progress || null,
            },
            events: [],
          }));
        }

        setNewConnections((ns) => ns.filter((n) => n.id !== acceptedConnectionId));
        setPreviewCardId(null);
        if (out?.conversation_id) {
          setActiveConversationId(out.conversation_id);
          await loadConversationMessages(out.conversation_id, backendProfile.$id);
        }

        if (Number(out?.voltz_earned || 0) > 0) {
          awardVoltzAmount(Number(out.voltz_earned));
        }

        if (acceptedConnectionId) {
          await hydrateRelationshipContext(acceptedConnectionId);
        }

        await refreshInboxData();
      } else {
        setNewConnections((ns) => ns.filter((n) => n.id !== acceptedConnectionId));
        setPreviewCardId(null);
        earnVoltz("reply_received");
      }
    } catch (err) {
      console.error("Accept connection failed:", err);
      earnVoltz("reply_received");
      setNewConnections((ns) => ns.filter((n) => n.id !== acceptedConnectionId));
      setPreviewCardId(null);
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleDecline = async () => {
    if (isActionBusy) return;
    setDeclined(true);

    setIsActionBusy(true);
    try {
      if (previewCardId && backendReady && backendProfile?.$id) {
        await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
          action: "decline_connection",
          connection_id: previewCardId,
        });
      }
    } catch (err) {
      console.error("Decline connection failed:", err);
    } finally {
      setIsActionBusy(false);
    }

    clearTimeout(declineTimerRef.current);
    declineTimerRef.current = setTimeout(async () => {
      if (previewCardId) {
        setNewConnections((ns) => ns.filter((n) => n.id !== previewCardId));
      }
      setPreviewCardId(null);
      closeChat();
      if (backendReady && backendProfile?.$id) {
        await refreshInboxData();
      }
    }, 3000);
  };

  const handleUndo = async () => {
    clearTimeout(declineTimerRef.current);
    if (previewCardId && backendReady && backendProfile?.$id) {
      try {
        await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
          action: "undo_decline",
          connection_id: previewCardId,
        });
      } catch (err) {
        console.error("Undo decline failed:", err);
      }
    }
    setDeclined(false);
  };

  const handleChipClick = (key) => {
    const chip = relationshipContext.chips.find((item) => item.key === key);
    if (!chip) return;

    if (activeChip === key) {
      setActiveChip(null);
    } else {
      setActiveChip(key);
    }
  };

  const handleTooltipDismiss = () => {
    if (activeChip) {
      setActiveChip(null);
    }
  };

  const activeTooltip = activeChip
    ? relationshipContext.chips.find((chip) => chip.key === activeChip)?.tooltip || null
    : null;

  const handleSend = async () => {
    if (isActionBusy) return;

    const v = input.trim();
    if (!v) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages((ms) => [...ms, { type: "out", text: v, time, read: false }]);
    setInput("");

    const fromDraft = nextSendFromDraft;
    setNextSendFromDraft(false);

    if (fromDraft) earnVoltz("ai_draft_used");

    if (!backendReady || !backendProfile?.$id || !activeConversationId || previewMode) {
      earnVoltz("message_sent");
      return;
    }

    setIsActionBusy(true);
    try {
      const out = await executeFunction(MESSAGE_GATEWAY_FUNCTION_ID, {
        action: "send_message",
        conversation_id: activeConversationId,
        body: v,
      });

      if (Number(out?.voltz_earned || 0) > 0) {
        awardVoltzAmount(Number(out.voltz_earned));
      } else {
        earnVoltz("message_sent");
      }

      if (backendProfile?.$id && activeConversationId) {
        removeCacheEntry(THREAD_CACHE_KEY(backendProfile.$id, activeConversationId));
        removeCacheEntry(INBOX_CACHE_KEY(backendProfile.$id));
      }

      await refreshInboxData(null, { forceRefresh: true });
    } catch (err) {
      console.error("Send message failed:", err);
      earnVoltz("message_sent");
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleUseDraft = (draft) => {
    setInput(draft);
    setNextSendFromDraft(true);
    setSheetOpen(false);
  };

  return (
    <>
      <StyleBlock />
      <div className="sc-root">
        <div className="sc-phone">
          <div className="sc-screens">
            <Inbox
              conversations={conversations}
              newConnections={newConnections}
              sentConnections={sentConnections}
              notifications={notifications}
              filter={filter}
              onFilter={setFilter}
              loading={inboxLoading}
              error={inboxError}
              notifOpen={notifOpen}
              setNotifOpen={setNotifOpen}
              onOpenConvo={handleOpenConvo}
              onOpenMove={handleOpenMove}
              onOpenNewPreview={(c) => enterPreview(c, false)}
              onOpenNewPreviewWithSheet={(c) => enterPreview(c, true)}
              onNotifClick={handleNotifClick}
              onMarkAllRead={handleMarkAllRead}
              markingAllRead={markingAllRead}
              voltzBalance={voltzBalance}
              onOpenVoltzModal={onOpenVoltzModal}
            />
            <Chat
              active={chatActive}
              profile={chatProfile}
              messages={messages}
              onBack={closeChat}
              activeChip={activeChip}
              onChipClick={handleChipClick}
              tooltip={activeTooltip}
              onTooltipDismiss={handleTooltipDismiss}
              stageProgress={relationshipContext.stageProgress}
              contextChips={relationshipContext.chips}
              input={input}
              setInput={setInput}
              onSend={handleSend}
              onOpenSheet={() => setSheetOpen(true)}
              onFillInput={(t) => setInput(t)}
              drawerOpen={drawerOpen}
              setDrawerOpen={setDrawerOpen}
              sheetOpen={sheetOpen}
              onCloseSheet={() => setSheetOpen(false)}
              onUseDraft={handleUseDraft}
              voltzToast={voltzToast}
              previewMode={previewMode}
              onAccept={handleAccept}
              onDecline={handleDecline}
              declined={declined}
              onUndo={handleUndo}
              voltz={voltzTotal}
              relationshipContext={relationshipContext}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// STYLES — scoped to .sc- prefix
// ============================================================================

const StyleBlock = () => (
  <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@300&display=swap');

.sc-root {
  --sc-bg:#FFFEFD; --sc-text:#1A1A1A; --sc-text2:#6B6B6B; --sc-text3:#AFAFAF;
  --sc-border:#1A1A1A; --sc-border-light:#DDDBD8; --sc-surface:#F5F3F0;
  --sc-hover:#FAFAF8; --sc-accent:#F5C842; --sc-success:#22A85A; --sc-error:#D84040;
  --sc-bottom-safe:calc(env(safe-area-inset-bottom, 0px) + 20px);
  --sc-ease:cubic-bezier(0.16, 1, 0.3, 1);
  font-family:'DM Sans',sans-serif;
  background:transparent;
  width:100%;
  min-height:100%;
  height:100%;
  padding:0;
  color:var(--sc-text);
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}
.sc-root *, .sc-root *::before, .sc-root *::after { box-sizing:border-box; }
.sc-root button { font-family:inherit; }

.sc-phone {
  width:100%; height:100%; background:var(--sc-bg);
  position:relative; overflow:hidden;
  display:flex; flex-direction:column;
  min-height:0;
}

.sc-screens { flex:1; position:relative; overflow:hidden; }
.sc-screen { position:absolute; inset:0; background:var(--sc-bg); display:flex; flex-direction:column; transition:transform 0.42s var(--sc-ease), opacity 0.42s var(--sc-ease); }
.sc-screen-inbox { z-index:1; transform:translateX(0); opacity:1; }
.sc-screen-chat  { z-index:2; transform:translateX(28px); opacity:0; pointer-events:none; }
.sc-screen-chat.active { transform:translateX(0); opacity:1; pointer-events:auto; }

/* Avatar cold state */
.sc-avatar-cold { filter:saturate(0.2) brightness(1.08); transition:filter 1.5s ease; }

/* Inbox header */
.sc-inbox-header { padding:16px 20px 10px; }
.sc-inbox-title-row { display:flex; justify-content:space-between; align-items:center; }
.sc-inbox-title { font-family:'Playfair Display',serif; font-weight:300; font-size:28px; letter-spacing:-0.3px; color:var(--sc-text); margin:0; }
.sc-bell-btn { background:none; border:none; padding:11px; margin:-11px; cursor:pointer; position:relative; color:var(--sc-text); }
.sc-bell-btn svg { display:block; }
.sc-bell-pip { position:absolute; top:8px; right:8px; width:6px; height:6px; border-radius:50%; background:var(--sc-accent); }

.sc-search { margin-top:10px; border:1.5px solid var(--sc-text); border-radius:999px; background:var(--sc-bg); padding:11px 18px; display:flex; align-items:center; gap:10px; }
.sc-search svg { flex-shrink:0; }
.sc-search input { border:none; outline:none; background:transparent; flex:1; font-family:'DM Sans',sans-serif; font-weight:400; font-size:14px; color:var(--sc-text); padding:0; }
.sc-search input::placeholder { color:var(--sc-text3); }

.sc-loading-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:var(--sc-text3); font-weight:500; font-size:13px; }
.sc-loading-spinner { width:24px; height:24px; border:2px solid var(--sc-border-light); border-top-color:var(--sc-text); border-radius:50%; display:inline-block; animation:sc-spin 0.8s linear infinite; }
.sc-inbox-error { margin:0 20px 8px; border:1px solid #F2D3D3; border-radius:10px; background:#FFF8F8; color:#B34747; font-size:12px; font-weight:500; padding:8px 10px; }

/* Filter chips */
.sc-filter-wrap { padding:10px 0 12px; overflow-x:auto; overflow-y:visible; }
.sc-filter-wrap::-webkit-scrollbar { display:none; }
.sc-filter-chips { padding:0 20px; display:flex; gap:10px; width:max-content; min-width:100%; }
.sc-chip { position:relative; overflow:visible; border:1.5px solid var(--sc-text); border-radius:999px; padding:9px 20px; font-weight:500; font-size:14px; color:var(--sc-text); background:var(--sc-bg); white-space:nowrap; cursor:pointer; transition:all 0.18s ease; }
.sc-chip.active { background:var(--sc-text); color:var(--sc-bg); }
.sc-chip-badge { position:absolute; top:-8px; right:-8px; min-width:20px; height:20px; border-radius:999px; background:#D84040; color:#FFFFFF; border:2.5px solid var(--sc-bg); font-weight:600; font-size:11px; display:flex; align-items:center; justify-content:center; padding:0 5px; line-height:1; }
.sc-chip-badge.green { background:var(--sc-success); }
.sc-chip-badge.purple { background:#7B5CF0; }

.sc-inbox-scroll { flex:1; overflow-y:auto; overflow-x:hidden; }
.sc-inbox-scroll::-webkit-scrollbar { width:0; }

.sc-section-label { padding:16px 20px 10px; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--sc-text3); }
.sc-section-label-row { display:flex; align-items:center; gap:10px; padding:16px 20px 10px; }
.sc-section-label-row .sc-section-label { padding:0; }
.sc-section-badge { min-width:18px; height:18px; border-radius:999px; background:var(--sc-text); color:var(--sc-bg); font-weight:600; font-size:10px; display:inline-flex; align-items:center; justify-content:center; padding:0 5px; line-height:1; }

.sc-moves-row { padding:0 20px 14px; display:flex; gap:12px; overflow-x:auto; }
.sc-moves-row::-webkit-scrollbar { display:none; }
.sc-move-card { width:220px; flex-shrink:0; border:1.5px solid var(--sc-text); border-radius:14px; padding:14px 16px; background:var(--sc-bg); cursor:pointer; transition:transform 0.18s ease; }
.sc-move-card:active { transform:scale(0.98); }
.sc-move-top { display:flex; align-items:center; gap:8px; }
.sc-move-name { font-weight:600; font-size:13px; color:var(--sc-text); line-height:1.2; }
.sc-move-role { font-weight:400; font-size:11px; color:var(--sc-text3); line-height:1.2; }
.sc-move-reason { font-weight:400; font-size:12px; color:var(--sc-text2); line-height:1.5; margin-top:6px; }
.sc-move-cta { margin-top:10px; border:1.5px solid var(--sc-text); border-radius:999px; padding:8px 0; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:600; font-size:12px; color:var(--sc-text); background:var(--sc-bg); cursor:pointer; width:100%; }
.sc-section-divider { border-bottom:1px solid var(--sc-border-light); }

/* Convo row */
.sc-convo { display:flex; align-items:center; gap:14px; padding:12px 20px; border-bottom:1px solid var(--sc-border-light); position:relative; cursor:pointer; min-height:72px; background:var(--sc-bg); }
.sc-convo:active { background:#FAFAF8; }
.sc-unread-dot { position:absolute; left:8px; top:50%; transform:translateY(-50%); width:6px; height:6px; border-radius:50%; background:var(--sc-text); }
.sc-convo-content { flex:1; min-width:0; }
.sc-convo-name { font-weight:600; font-size:15px; color:var(--sc-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25; }
.sc-convo-name.read { font-weight:500; }
.sc-convo-sub { font-weight:400; font-size:12px; color:var(--sc-text3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
.sc-convo-preview { font-weight:600; font-size:13px; color:var(--sc-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
.sc-convo-preview.read { font-weight:400; color:var(--sc-text2); }
.sc-convo-right { display:flex; flex-direction:column; align-items:flex-end; justify-content:flex-start; gap:6px; flex-shrink:0; padding-top:2px; }
.sc-timestamp { font-weight:400; font-size:12px; color:var(--sc-text3); }
.sc-unread-badge { width:22px; height:22px; border-radius:50%; background:var(--sc-text); color:var(--sc-bg); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:12px; }
.sc-swipe-affordance { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:2px; height:28px; background:var(--sc-border-light); border-radius:2px; opacity:0.6; }

/* Empty state */
.sc-empty-state { text-align:center; padding:60px 20px; font-weight:400; font-size:14px; color:var(--sc-text3); font-style:italic; }

/* New feed */
.sc-new-feed { padding:0 20px 20px; }
.sc-new-card { background:var(--sc-bg); border:1.5px solid var(--sc-text); border-radius:18px; padding:18px 18px 14px; margin:0 0 10px; cursor:pointer; }
.sc-new-card-top { display:flex; align-items:center; gap:12px; }
.sc-new-card-name { font-weight:600; font-size:15px; color:var(--sc-text); line-height:1.2; }
.sc-new-card-role { font-weight:400; font-size:12px; color:var(--sc-text3); margin-top:1px; }
.sc-new-card-info { flex:1; min-width:0; }
.sc-score-badge { font-weight:600; font-size:12px; border-radius:8px; padding:4px 9px; flex-shrink:0; }
.sc-score-badge.high { background:#E1F5EE; color:#0F6E56; }
.sc-score-badge.mid  { background:#FAEEDA; color:#854F0B; }
.sc-score-badge.low  { background:#F1EFE8; color:#888; }
.sc-new-card-msg { background:#F5F3F0; border-radius:12px; padding:9px 12px; margin:10px 0; font-weight:400; font-size:13px; color:var(--sc-text); line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; }
.sc-new-card-foot { display:flex; align-items:center; justify-content:space-between; margin-top:2px; gap:10px; }
.sc-new-card-dots { display:flex; align-items:center; gap:5px; flex-shrink:0; }
.sc-new-card-dot { width:8px; height:8px; border-radius:50%; }
.sc-new-card-ctas { display:flex; gap:8px; }
.sc-new-cta-primary { background:var(--sc-accent); border:1.5px solid var(--sc-accent); border-radius:999px; padding:7px 14px; display:flex; align-items:center; gap:6px; font-weight:600; font-size:12px; color:var(--sc-text); cursor:pointer; }
.sc-new-cta-open { border:1.5px solid var(--sc-text); border-radius:999px; padding:7px 14px; font-weight:600; font-size:12px; color:var(--sc-text); background:transparent; cursor:pointer; }

/* Notif panel */
.sc-notif-panel { position:absolute; top:64px; right:16px; width:320px; background:var(--sc-bg); border:1.5px solid var(--sc-text); border-radius:14px; box-shadow:0 8px 32px rgba(0,0,0,0.10); z-index:600; opacity:0; transform:translateY(-8px); pointer-events:none; transition:opacity 0.22s ease-out, transform 0.22s ease-out; overflow:hidden; }
.sc-notif-panel.visible { opacity:1; transform:translateY(0); pointer-events:auto; }
.sc-notif-header { padding:14px 18px 10px; border-bottom:1px solid var(--sc-border-light); display:flex; align-items:center; justify-content:space-between; }
.sc-notif-title { font-weight:600; font-size:14px; color:var(--sc-text); }
.sc-notif-mark { font-weight:400; font-size:12px; color:var(--sc-text3); background:none; border:none; cursor:pointer; padding:4px 0; }
.sc-notif-mark:disabled { opacity:0.55; cursor:default; }
.sc-notif-list { max-height:380px; overflow-y:auto; }
.sc-notif-list::-webkit-scrollbar { width:0; }
.sc-notif-item { padding:12px 18px; border-bottom:1px solid var(--sc-border-light); display:flex; gap:12px; align-items:flex-start; cursor:pointer; }
.sc-notif-item:last-child { border-bottom:none; }
.sc-notif-body { flex:1; min-width:0; }
.sc-notif-text { font-weight:400; font-size:13px; color:var(--sc-text2); line-height:1.5; }
.sc-notif-cta { margin-top:8px; border:1.5px solid var(--sc-text); border-radius:999px; padding:6px 14px; font-weight:600; font-size:12px; color:var(--sc-text); background:var(--sc-bg); cursor:pointer; display:inline-block; }
.sc-notif-time { font-weight:400; font-size:11px; color:var(--sc-text3); flex-shrink:0; padding-top:2px; }
.sc-notif-empty { font-weight:400; font-size:13px; color:var(--sc-text3); font-style:italic; text-align:center; padding:20px; }

/* Chat header */
.sc-chat-header { padding:10px 20px; border-bottom:1px solid var(--sc-border-light); }
.sc-chat-header-row { display:flex; align-items:center; gap:12px; }
.sc-back-btn { background:none; border:none; font-size:26px; color:var(--sc-text); font-weight:400; padding:6px 10px 6px 0; margin-left:-4px; cursor:pointer; min-height:44px; display:flex; align-items:center; line-height:1; }
.sc-chat-header-info { flex:1; display:flex; align-items:center; gap:10px; min-width:0; }
.sc-chat-header-text { min-width:0; flex:1; }
.sc-chat-name { font-weight:600; font-size:17px; color:var(--sc-text); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sc-chat-role { font-weight:400; font-size:12px; color:var(--sc-text3); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sc-swipe-hint-hit { padding:8px 4px 8px 12px; margin-right:-4px; min-height:44px; display:flex; align-items:center; cursor:pointer; background:transparent; border:none; }
.sc-swipe-hint { display:flex; align-items:center; gap:5px; border:1.5px solid var(--sc-text); border-radius:999px; padding:5px 10px; background:var(--sc-bg); pointer-events:none; }
.sc-swipe-hint-text { font-size:10px; color:var(--sc-text); font-weight:600; letter-spacing:0.02em; }
.sc-swipe-hint-chev { font-size:12px; color:var(--sc-text); font-weight:500; line-height:1; }

.sc-progress { margin-top:8px; }
.sc-progress-track { display:flex; gap:3px; }
.sc-progress-seg { flex:1; height:3px; border-radius:2px; background:var(--sc-border-light); }
.sc-progress-seg.done { background:var(--sc-text); }
.sc-progress-labels { display:flex; justify-content:space-between; margin-top:5px; font-weight:400; font-size:11px; color:var(--sc-text3); }

.sc-context-chips { margin-top:8px; display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; }
.sc-context-chips::-webkit-scrollbar { display:none; }
.sc-context-chip { border:1.5px solid var(--sc-text); border-radius:999px; padding:5px 14px; font-weight:500; font-size:11px; color:var(--sc-text); background:var(--sc-bg); white-space:nowrap; flex-shrink:0; cursor:pointer; transition:all 0.18s ease; }
.sc-context-chip.active { background:var(--sc-text); color:var(--sc-bg); }
.sc-chip-tooltip { position:absolute; left:20px; right:20px; top:16px; background:var(--sc-bg); border:1.5px solid var(--sc-text); border-radius:14px; padding:14px 16px; box-shadow:0 4px 16px rgba(0,0,0,0.08); font-weight:400; font-size:13px; color:var(--sc-text2); line-height:1.55; z-index:50; transform:translateY(-6px); opacity:0; pointer-events:none; transition:all 0.25s var(--sc-ease); }
.sc-chip-tooltip.visible { transform:translateY(0); opacity:1; pointer-events:auto; }

/* Thread */
.sc-thread { flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:10px; background:var(--sc-bg); position:relative; }
.sc-thread::-webkit-scrollbar { width:0; }
.sc-time-sep { font-weight:400; font-size:11px; color:var(--sc-text3); text-align:center; margin:6px auto; padding:4px 0; }
.sc-msg-group-in { display:flex; gap:8px; align-items:flex-end; max-width:88%; }
.sc-bubble-in { background:#F0EDE8; border:none; border-radius:22px; padding:10px 14px; font-weight:400; font-size:14px; color:var(--sc-text); line-height:1.55; max-width:100%; }
.sc-bubble-out-wrap { align-self:flex-end; max-width:78%; display:flex; flex-direction:column; align-items:flex-end; }
.sc-bubble-out { background:#1A1A1A; border:none; border-radius:22px; padding:10px 14px; font-weight:400; font-size:14px; color:#FFFEFD; line-height:1.55; }
.sc-receipt { font-weight:400; font-size:10px; margin-top:3px; padding:0 4px; }
.sc-receipt.delivered { color:var(--sc-text3); }
.sc-receipt.read { color:var(--sc-text2); }
.sc-preview-hint { text-align:center; font-weight:400; font-size:11px; color:var(--sc-text3); padding:8px 0; margin-top:4px; }

/* AI strip */
.sc-ai-strip { border-top:1px solid var(--sc-border-light); padding:8px 14px; display:flex; gap:8px; overflow-x:auto; flex-shrink:0; }
.sc-ai-strip::-webkit-scrollbar { display:none; }
.sc-ai-primary { background:var(--sc-accent); border:1.5px solid var(--sc-accent); border-radius:999px; padding:8px 16px; display:flex; align-items:center; gap:8px; font-weight:600; font-size:13px; color:var(--sc-text); cursor:pointer; white-space:nowrap; flex-shrink:0; }
.sc-ai-secondary { border:1.5px solid var(--sc-text); border-radius:999px; padding:8px 16px; font-weight:500; font-size:13px; color:var(--sc-text); background:var(--sc-bg); white-space:nowrap; flex-shrink:0; cursor:pointer; }

/* Input bar */
.sc-input-bar { border-top:1px solid var(--sc-border-light); padding:10px 16px var(--sc-bottom-safe); display:flex; align-items:center; gap:10px; background:var(--sc-bg); flex-shrink:0; }
.sc-ai-orb { width:36px; height:36px; border-radius:50%; border:1.5px solid var(--sc-text); background:var(--sc-bg); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.sc-input-field { flex:1; border:1.5px solid var(--sc-text); border-radius:999px; background:var(--sc-bg); padding:4px 4px 4px 16px; display:flex; align-items:center; gap:8px; min-height:40px; position:relative; }
.sc-input-field input { flex:1; border:none; outline:none; background:transparent; font-family:'DM Sans',sans-serif; font-weight:400; font-size:14px; color:var(--sc-text); padding:6px 0; min-width:0; }
.sc-input-field input::placeholder { color:var(--sc-text3); }
.sc-input-right { position:relative; width:36px; height:32px; flex-shrink:0; }
.sc-send-btn { width:32px; height:32px; border-radius:50%; background:#F2F0EC; border:1px solid #DDD9D2; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; pointer-events:none; transition:opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease; position:absolute; right:0; top:50%; transform:translateY(-50%); }
.sc-send-btn.visible { opacity:1; pointer-events:auto; }
.sc-send-btn.neutral.active { background:#ECE9E3; border-color:#CFC8BC; }
.sc-send-btn svg { display:block; }

/* Sheet */
.sc-sheet-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); z-index:400; opacity:0; pointer-events:none; transition:opacity 0.38s var(--sc-ease); }
.sc-sheet-overlay.visible { opacity:1; pointer-events:auto; }
.sc-sheet { position:absolute; left:0; right:0; bottom:0; background:var(--sc-bg); border-radius:22px 22px 0 0; box-shadow:0 -4px 24px rgba(0,0,0,0.07); padding:0 20px calc(var(--sc-bottom-safe) + 8px); z-index:401; transform:translateY(100%); transition:transform 0.38s var(--sc-ease); max-height:85%; overflow-y:auto; }
.sc-sheet::-webkit-scrollbar { width:0; }
.sc-sheet.visible { transform:translateY(0); }
.sc-sheet-handle { width:40px; height:4px; background:var(--sc-border-light); border-radius:999px; margin:14px auto 20px; }
.sc-sheet-label { font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--sc-text3); }
.sc-sheet-draft { width:100%; border:none; border-bottom:1.5px solid var(--sc-text); background:transparent; font-family:'Playfair Display',serif; font-weight:300; font-size:17px; color:var(--sc-text); line-height:1.65; padding:12px 0; outline:none; resize:none; margin-top:8px; min-height:100px; }
.sc-sheet-hint { font-weight:400; font-size:12px; color:var(--sc-text3); font-style:italic; margin-top:8px; }
.sc-tone-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
.sc-tone-chip { border:1.5px solid var(--sc-text); border-radius:999px; padding:9px 20px; font-weight:500; font-size:13px; color:var(--sc-text); background:var(--sc-bg); cursor:pointer; transition:all 0.18s ease; }
.sc-tone-chip.active.warm      { background:#FFF3E0; border-color:#E8A94A; color:#C17F24; }
.sc-tone-chip.active.direct    { background:var(--sc-text); border-color:var(--sc-text); color:var(--sc-bg); }
.sc-tone-chip.active.curious   { background:#EEF2FF; border-color:#5B8CF5; color:#2A5BD7; }
.sc-tone-chip.active.confident { background:#F0FDF4; border-color:#3DAA82; color:#1A7A52; }
.sc-tell-input { width:100%; border:none; border-bottom:1.5px solid var(--sc-text); background:transparent; font-family:'Playfair Display',serif; font-weight:300; font-size:18px; color:var(--sc-text); padding:10px 0; outline:none; margin-top:10px; }
.sc-tell-input::placeholder { color:var(--sc-text3); }
.sc-btn-outline { width:100%; border:1.5px solid var(--sc-text); border-radius:999px; padding:14px; font-weight:600; font-size:14px; color:var(--sc-text); background:var(--sc-bg); cursor:pointer; margin-top:16px; }
.sc-btn-filled { width:100%; background:#4F7FFA; border:none; border-radius:999px; padding:14px; font-weight:600; font-size:14px; color:#fff; cursor:pointer; margin-top:10px; }

/* Drawer */
.sc-drawer-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.2); z-index:300; opacity:0; pointer-events:none; transition:opacity 0.42s var(--sc-ease); }
.sc-drawer-overlay.visible { opacity:1; pointer-events:auto; }
.sc-drawer { position:absolute; top:0; bottom:0; right:0; width:92%; background:var(--sc-bg); border-left:1px solid var(--sc-border-light); box-shadow:-4px 0 20px rgba(0,0,0,0.06); border-radius:22px 0 0 22px; transform:translateX(100%); transition:transform 0.42s var(--sc-ease); z-index:301; display:flex; flex-direction:column; overflow:hidden; }
.sc-drawer.visible { transform:translateX(0); }
.sc-drawer-header { padding:14px 20px; border-bottom:1px solid var(--sc-border-light); display:flex; align-items:center; gap:12px; flex-shrink:0; }
.sc-drawer-back { background:none; border:none; font-size:24px; color:var(--sc-text3); font-weight:400; padding:10px 6px 10px 0; cursor:pointer; line-height:1; }
.sc-drawer-name { font-weight:600; font-size:15px; color:var(--sc-text); line-height:1.2; }
.sc-drawer-role { font-weight:400; font-size:12px; color:var(--sc-text3); margin-top:1px; }
.sc-drawer-scroll { flex:1; overflow-y:auto; padding:20px 20px calc(var(--sc-bottom-safe) + 20px); }
.sc-drawer-scroll::-webkit-scrollbar { width:0; }
.sc-drawer-section { margin-bottom:24px; }
.sc-drawer-section:last-child { margin-bottom:0; }
.sc-drawer-section.with-divider { border-bottom:1px solid var(--sc-border-light); padding-bottom:16px; }
.sc-drawer-label { font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--sc-text3); margin-bottom:10px; }

.sc-match-summary { font-family:'Playfair Display',serif; font-weight:300; font-size:22px; color:var(--sc-text); line-height:1.55; }
.sc-stage-pill-lg { display:inline-block; border:1.5px solid var(--sc-text); border-radius:999px; padding:4px 12px; font-weight:500; font-size:12px; color:var(--sc-text); margin-top:10px; }
.sc-stage-pill-wrap { display:block; margin-top:10px; }

.sc-rel-number { font-family:'Playfair Display',serif; font-weight:300; font-size:48px; color:var(--sc-text); line-height:1; margin-top:6px; }
.sc-rel-status { display:inline-block; border:1.5px solid var(--sc-text); border-radius:999px; padding:4px 12px; font-weight:500; font-size:12px; color:var(--sc-text); margin-top:10px; }
.sc-rel-submetrics { display:flex; gap:16px; flex-wrap:wrap; margin-top:10px; }
.sc-rel-metric-label { font-weight:400; font-size:11px; color:var(--sc-text3); display:block; }
.sc-rel-metric-value { font-weight:600; font-size:12px; color:var(--sc-text); margin-top:2px; display:block; }
.sc-voltz-line { margin-top:12px; font-weight:400; font-size:11px; color:var(--sc-text3); }
.sc-voltz-line strong { font-weight:600; color:#C49B0A; }

.sc-breakdown-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.sc-breakdown-label { font-weight:400; font-size:12px; color:var(--sc-text2); width:80px; flex-shrink:0; }
.sc-breakdown-track { flex:1; height:3px; background:var(--sc-border-light); border-radius:2px; overflow:hidden; }
.sc-breakdown-fill { height:100%; background:var(--sc-text); border-radius:2px; transition:width 0.6s var(--sc-ease); }
.sc-breakdown-val { font-weight:500; font-size:11px; color:var(--sc-text3); width:24px; text-align:right; }
.sc-breakdown-row[data-dim="background"] .sc-breakdown-fill { background:#5B8CF5; }
.sc-breakdown-row[data-dim="background"] .sc-breakdown-val  { color:#5B8CF5; }
.sc-breakdown-row[data-dim="goals"]      .sc-breakdown-fill { background:#3DAA82; }
.sc-breakdown-row[data-dim="goals"]      .sc-breakdown-val  { color:#3DAA82; }
.sc-breakdown-row[data-dim="network"]    .sc-breakdown-fill { background:#9B7CF6; }
.sc-breakdown-row[data-dim="network"]    .sc-breakdown-val  { color:#9B7CF6; }
.sc-breakdown-row[data-dim="stage"]      .sc-breakdown-fill { background:#E8A94A; }
.sc-breakdown-row[data-dim="stage"]      .sc-breakdown-val  { color:#E8A94A; }

.sc-rel-chart { background:var(--sc-bg); border-radius:14px; border:1px solid var(--sc-border-light); padding:14px 14px 10px; margin-top:8px; }
.sc-rel-transitions { display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:10px; }
.sc-rel-transition { display:inline-flex; align-items:center; gap:4px; font-weight:400; font-size:10px; color:var(--sc-text3); }
.sc-rel-transition-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.sc-rel-empty { font-weight:400; font-size:12px; color:var(--sc-text3); font-style:italic; margin-top:10px; }

.sc-drawer-signals-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; margin-top:8px; }
.sc-drawer-signal-item { display:flex; align-items:center; gap:6px; font-weight:400; font-size:12px; color:var(--sc-text2); }
.sc-drawer-signal-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

/* Timeline */
.sc-timeline-item { display:flex; gap:10px; position:relative; }
.sc-timeline-left { width:14px; display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
.sc-timeline-dot { width:8px; height:8px; border-radius:50%; margin-top:4px; flex-shrink:0; }
.sc-timeline-line { width:1px; flex:1; background:var(--sc-border-light); margin-top:2px; }
.sc-timeline-content { flex:1; padding-bottom:14px; }
.sc-timeline-label { font-weight:400; font-size:12px; color:var(--sc-text2); line-height:1.3; }
.sc-timeline-date { font-weight:400; font-size:11px; color:var(--sc-text3); margin-top:2px; }

/* Milestones */
.sc-milestone { display:flex; align-items:center; gap:10px; padding:6px 0; }
.sc-milestone-icon { width:22px; height:22px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sc-milestone-label { flex:1; font-weight:400; font-size:12px; }
.sc-milestone-label.done    { color:var(--sc-success); }
.sc-milestone-label.pending { color:#9B7CF6; }
.sc-milestone-label.locked  { color:var(--sc-text3); }
.sc-milestone-date { font-weight:400; font-size:11px; color:var(--sc-text3); }

/* Next step */
.sc-next-step { border:1.5px solid var(--sc-text); border-radius:14px; padding:14px 16px; background:var(--sc-bg); }
.sc-next-step-top { display:flex; align-items:center; gap:6px; }
.sc-next-step-body { font-weight:400; font-size:13px; color:var(--sc-text2); line-height:1.55; margin-top:6px; }
.sc-next-step-cta { width:100%; border:1.5px solid var(--sc-text); border-radius:999px; padding:10px; font-weight:600; font-size:13px; color:var(--sc-text); background:var(--sc-bg); cursor:pointer; margin-top:12px; }

/* Notes */
.sc-note-entry { border-bottom:1px solid var(--sc-border-light); padding:10px 0; }
.sc-note-entry:last-child { border-bottom:none; }
.sc-note-date { font-weight:400; font-size:11px; color:var(--sc-text3); }
.sc-note-body { font-family:'Playfair Display',serif; font-weight:300; font-size:14px; color:var(--sc-text2); line-height:1.6; margin-top:4px; }

/* Preview / request */
.sc-preview-banner { background:#FFFBF0; border-bottom:1px solid #F5E8C0; padding:10px 18px; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.sc-preview-banner svg { flex-shrink:0; }
.sc-preview-banner-text { font-family:'DM Sans',sans-serif; font-size:12px; font-weight:400; color:#A07800; line-height:1.4; }
.sc-request-bar { border-top:1px solid var(--sc-border-light); padding:12px 16px var(--sc-bottom-safe); display:flex; gap:10px; background:var(--sc-bg); flex-shrink:0; }
.sc-btn-accept { flex:1; background:var(--sc-text); color:var(--sc-bg); border:none; border-radius:999px; padding:14px 0; font-weight:600; font-size:15px; cursor:pointer; transition:opacity 0.15s ease; }
.sc-btn-accept:hover { opacity:0.82; }
.sc-btn-decline { flex:0 0 auto; background:transparent; color:var(--sc-text3); border:1.5px solid var(--sc-border-light); border-radius:999px; padding:14px 22px; font-weight:400; font-size:15px; cursor:pointer; transition:all 0.15s ease; }
.sc-btn-decline:hover { border-color:var(--sc-text); color:var(--sc-text); }
.sc-decline-confirm { border-top:1px solid var(--sc-border-light); padding:16px 16px var(--sc-bottom-safe); display:flex; align-items:center; justify-content:center; gap:12px; background:var(--sc-bg); flex-shrink:0; }
.sc-decline-confirm-text { font-weight:400; font-size:13px; color:var(--sc-text3); }
.sc-decline-undo { background:none; border:none; font-weight:500; font-size:12px; color:var(--sc-text); text-decoration:underline; text-underline-offset:2px; cursor:pointer; padding:4px; }

/* Voltz toast */
.sc-voltz-toast { position:absolute; top:72px; left:50%; transform:translateX(-50%) translateY(-8px); background:var(--sc-text); color:var(--sc-bg); border-radius:999px; padding:7px 16px; display:flex; align-items:center; gap:6px; font-size:13px; font-weight:500; box-shadow:0 4px 16px rgba(0,0,0,0.15); z-index:100; white-space:nowrap; opacity:0; pointer-events:none; }
.sc-voltz-toast.visible { animation:sc-toastIn 0.3s var(--sc-ease) forwards, sc-toastOut 0.3s ease 2.2s forwards; }
@keyframes sc-toastIn { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
@keyframes sc-toastOut { from { opacity:1; } to { opacity:0; transform:translateX(-50%) translateY(-4px); } }
@keyframes sc-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

@media (min-width: 1024px) {
  .sc-root { padding:0; }
  .sc-phone {
    width:100%;
    height:100%;
    border:none;
    border-radius:0;
    box-shadow:none;
  }
}

@media (max-width: 420px) {
  .sc-root { padding:0; }
  .sc-phone { width:100%; height:100%; border-radius:0; box-shadow:none; border:none; }
}
  `}</style>
);
