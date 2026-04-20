import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

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

const INITIAL_CONVERSATIONS = [
  { id: "tom",    name: "Tom Hargreaves", role: "Angel Investor",
    initials: "TH", color: AVATAR_COLORS.red, cold: true,
    preview: '"Let\'s circle back after the weekend"', previewFromYou: false,
    timestamp: "7d", unread: 0, section: "attention" },
  { id: "mei",    name: "Mei Lin", role: "Founder · Atlas Labs",
    initials: "ML", color: AVATAR_COLORS.green,
    preview: 'You: "Would love to hear how Atlas is thinking about..."', previewFromYou: true,
    timestamp: "3d", unread: 0, section: "attention" },
  { id: "sarah",  name: "Sarah Chen", role: "VC Associate · Sequoia",
    initials: "SC", color: AVATAR_COLORS.purple,
    preview: '"Thursday works — send me the deck beforehand?"', previewFromYou: false,
    timestamp: "2m", unread: 3, section: "main" },
  { id: "james",  name: "James Okonkwo", role: "Product Lead · Notion",
    initials: "JO", color: AVATAR_COLORS.blue,
    preview: '"Glad this resonated — what are you building?"', previewFromYou: false,
    timestamp: "1h", unread: 1, section: "main" },
  { id: "priya",  name: "Priya Nair", role: "Head of Partnerships · a16z",
    initials: "PN", color: AVATAR_COLORS.amber,
    preview: 'You: "Sent you the one-pager — let me know"', previewFromYou: true,
    timestamp: "Yesterday", unread: 0, section: "main" },
  { id: "daniel", name: "Daniel Kaur", role: "Eng Manager · Stripe",
    initials: "DK", color: AVATAR_COLORS.violet,
    preview: '"Happy to chat — next week better for you?"', previewFromYou: false,
    timestamp: "Mon", unread: 0, section: "main" },
  { id: "ellie",  name: "Ellie Wright", role: "GP · Local Globe",
    initials: "EW", color: AVATAR_COLORS.teal,
    preview: '"Interesting — who else is in the round?"', previewFromYou: false,
    timestamp: "Sun", unread: 0, section: "main" },
  { id: "marcus", name: "Marcus Reid", role: "Founder · Loom (alum)",
    initials: "MR", color: AVATAR_COLORS.orange,
    preview: 'You: "Coffee was great — will send the doc tomorrow"', previewFromYou: true,
    timestamp: "Fri", unread: 0, section: "main" },
  { id: "anna",   name: "Anna Park", role: "PM · Figma",
    initials: "AP", color: AVATAR_COLORS.sky,
    preview: '"Love the idea — intro\'d you to Ben"', previewFromYou: false,
    timestamp: "Thu", unread: 0, section: "main" }
];

const INITIAL_NEW_CONNECTIONS = [
  { id: "ep", initials: "EP", color: "#7B5CF0", name: "Elena Popescu",
    role: "Founder · Meridian AI", score: 88, scoreTier: "high",
    message: "Hi — came across Supercharged through the Oxford network. The AI-matching angle is exactly what I've been thinking about. Would love to connect.",
    dots: ["#3DAA82", "#5B8CF5", "#9B7CF6"] },
  { id: "mk", initials: "MK", color: "#10B981", name: "Marcus Kim",
    role: "Partner · Lightspeed", score: 79, scoreTier: "mid",
    message: "Your profile came up through a mutual at Index. Building in the professional graph space — happy to share notes.",
    dots: ["#3DAA82", "#5B8CF5", "#E8A94A"] },
  { id: "fs", initials: "FS", color: "#F59E0B", name: "Fatima Syed",
    role: "Head of Product · Monzo", score: 74, scoreTier: "mid",
    message: "Saw you spoke at the Oxford Entrepreneurs event last term. Would be great to hear more about what you're building.",
    dots: ["#5B8CF5", "#9B7CF6"] }
];

const INITIAL_NOTIFICATIONS = [
  { id: "n1", initials: "TH", color: AVATAR_COLORS.red,
    text: "You haven't followed up with Tom in 5 days — want to?", time: "2h" },
  { id: "n2", initials: "ML", color: AVATAR_COLORS.green,
    text: "Mei hasn't replied in 3 days — a soft nudge could land well.", time: "5h" },
  { id: "n3", initials: "SC", color: AVATAR_COLORS.purple,
    text: "Sarah confirmed Thursday — time to send the deck.", time: "1d" }
];

const TODAYS_MOVES = [
  { id: "mv-sarah", convoId: "sarah", initials: "SC", color: AVATAR_COLORS.purple,
    name: "Sarah Chen", role: "VC · Sequoia",
    reason: "Replied yesterday — good moment to move forward" },
  { id: "mv-james", convoId: "james", initials: "JO", color: AVATAR_COLORS.blue,
    name: "James Okonkwo", role: "Product · Notion",
    reason: "Mentioned shipping this week — check in" },
  { id: "mv-mei",   convoId: "mei", initials: "ML", color: AVATAR_COLORS.green,
    name: "Mei Lin", role: "Founder · Atlas",
    reason: "Outreach sent 5 days ago — gentle nudge" }
];

const SARAH_MESSAGES = [
  { type: "sep", text: "Yesterday · 4:12 PM" },
  { type: "in", text: "Hey — got your note. Appreciate the thoughtful pitch, most cold emails aren't this specific." },
  { type: "out", text: "Thank you — tried to make sure it actually landed. Would love 20 min if you're open to it.", time: "4:28 PM", read: true },
  { type: "in", text: "Sure. What's the best way to get a sense of what you're building before we hop on?" },
  { type: "sep", text: "Today · 9:24 AM" },
  { type: "out", text: "I'll send over a short deck. Would Thursday afternoon work? Flexible around your calendar.", time: "9:26 AM", read: true },
  { type: "in", text: "Thursday works — send me the deck beforehand? Also, quick q: how are you thinking about the B2B wedge vs going direct to consumer first?" }
];

const CHIP_TOOLTIPS = {
  lse:   "She graduated 2019, you 2026 — mention the LSE entrepreneurship network or the alumni investor community.",
  ai:    "Sarah has tracked AI infra for 6 months and wrote a thesis piece on it. Lean into your inference layer differentiation.",
  index: "Marcus Reid (ex-Loom) knows you both. A warm intro to Sarah's colleague at Sequoia could come from him.",
  seed:  "Sequoia's seed programme is active and they often lead. Sarah flagged you as early-stage — no need to pretend otherwise."
};

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

const Search = () => (
  <label className="sc-search">
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#AFAFAF" strokeWidth="1.5"/>
      <path d="M10.5 10.5L14 14" stroke="#AFAFAF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <input type="text" placeholder="Search connections..." />
  </label>
);

const FilterChips = ({ active, counts, onChange }) => {
  const items = [
    { key: "all",    label: "All",    count: counts.all,    tone: "red" },
    { key: "unread", label: "Unread", count: counts.unread, tone: "red" },
    { key: "new",    label: "New",    count: counts.new,    tone: "green" }
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
              <span className={`sc-chip-badge ${it.tone === "green" ? "green" : ""}`}>{it.count}</span>
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

const TodaysMoves = ({ onOpenMove }) => (
  <>
    <div className="sc-section-label-row">
      <div className="sc-section-label">Today's moves</div>
      <span className="sc-section-badge">{TODAYS_MOVES.length}</span>
    </div>
    <div className="sc-moves-row">
      {TODAYS_MOVES.map(m => (
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

const NotifPanel = ({ open, items, onItemClick, onMarkAllRead, panelRef }) => (
  <div ref={panelRef} className={`sc-notif-panel ${open ? "visible" : ""}`}>
    <div className="sc-notif-header">
      <span className="sc-notif-title">Notifications</span>
      <button className="sc-notif-mark" onClick={onMarkAllRead}>Mark all read</button>
    </div>
    <div className="sc-notif-list">
      {items.length === 0 ? (
        <div className="sc-notif-empty">No new nudges — you're on top of it</div>
      ) : (
        items.map(n => (
          <div key={n.id} className="sc-notif-item" onClick={() => onItemClick(n)}>
            <Avatar initials={n.initials} color={n.color} size={36} fontSize={12} />
            <div className="sc-notif-body">
              <div className="sc-notif-text">{n.text}</div>
              <button className="sc-notif-cta" onClick={(e) => { e.stopPropagation(); onItemClick(n); }}>
                Draft ›
              </button>
            </div>
            <div className="sc-notif-time">{n.time}</div>
          </div>
        ))
      )}
    </div>
  </div>
);

// ============================================================================
// DOT LEGEND
// ============================================================================

const DotLegend = ({ visible, onDismiss }) => (
  <div className={`sc-legend-overlay ${visible ? "visible" : ""}`} onClick={onDismiss}>
    <div className="sc-legend-card">
      <div className="sc-legend-header">What the dots mean</div>
      <div className="sc-legend-grid">
        {[
          ["#3DAA82", "Compatibility match"],
          ["#5B8CF5", "Shared background"],
          ["#9B7CF6", "Network fit"],
          ["#E8A94A", "Recently active"]
        ].map(([color, label]) => (
          <div key={label} className="sc-legend-item">
            <span className="sc-legend-dot" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
      <div className="sc-legend-hint">Tap anywhere to dismiss</div>
    </div>
  </div>
);

// ============================================================================
// INBOX (assembled)
// ============================================================================

const Inbox = ({
  conversations, newConnections, notifications, filter, onFilter,
  notifOpen, setNotifOpen, legendVisible, setLegendSeen,
  onOpenConvo, onOpenMove, onOpenNewPreview, onOpenNewPreviewWithSheet,
  onNotifClick, onMarkAllRead
}) => {
  const notifRef = useRef(null);
  const bellRef = useRef(null);

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

  const visibleConvos = useMemo(() => {
    if (filter === "unread") return conversations.filter(c => c.unread > 0);
    return conversations;
  }, [filter, conversations]);

  const counts = {
    all: conversations.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0),
    unread: conversations.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0),
    new: newConnections.length
  };

  return (
    <div className="sc-screen sc-screen-inbox">
      <div className="sc-inbox-header">
        <div className="sc-inbox-title-row">
          <h1 className="sc-inbox-title">Inbox</h1>
          <div ref={bellRef} style={{ position: "relative" }}>
            <BellButton
              onClick={(e) => { e.stopPropagation(); setNotifOpen(o => !o); }}
              hasPip={notifications.length > 0}
            />
          </div>
        </div>
        <Search />
      </div>

      <FilterChips active={filter} counts={counts} onChange={onFilter} />

      {filter === "new" ? (
        <NewFeed
          connections={newConnections}
          onOpen={onOpenNewPreview}
          onReplyAI={onOpenNewPreviewWithSheet}
        />
      ) : filter === "unread" && visibleConvos.length === 0 ? (
        <EmptyState>You're all caught up</EmptyState>
      ) : (
        <div className="sc-inbox-scroll">
          {filter === "all" && <TodaysMoves onOpenMove={onOpenMove} />}
          {visibleConvos.map(c => (
            <ConvoRow key={c.id} c={c} onOpen={onOpenConvo} />
          ))}
        </div>
      )}

      <NotifPanel
        panelRef={notifRef}
        open={notifOpen}
        items={notifications}
        onItemClick={onNotifClick}
        onMarkAllRead={onMarkAllRead}
      />

      <DotLegend visible={legendVisible} onDismiss={setLegendSeen} />
    </div>
  );
};

// ============================================================================
// CHAT — HEADER, THREAD, INPUT
// ============================================================================

const ChatHeader = ({ profile, onBack, onOpenDrawer, activeChip, onChipClick }) => (
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
      <div className="sc-swipe-hint-hit" role="button" aria-label="Open context" onClick={onOpenDrawer}>
        <div className="sc-swipe-hint">
          <span className="sc-swipe-hint-bar" />
          <span className="sc-swipe-hint-chev">›</span>
        </div>
      </div>
    </div>

    <div className="sc-progress">
      <div className="sc-progress-track">
        <div className="sc-progress-seg done" />
        <div className="sc-progress-seg done" />
        <div className="sc-progress-seg" />
        <div className="sc-progress-seg" />
        <div className="sc-progress-seg" />
      </div>
      <div className="sc-progress-labels">
        <span>First reply</span>
        <span>Call booked</span>
      </div>
    </div>

    <div className="sc-context-chips">
      {[
        { key: "lse", label: "Both LSE" },
        { key: "ai", label: "AI infra focus" },
        { key: "index", label: "Mutual at Index" },
        { key: "seed", label: "Seed stage" }
      ].map(c => (
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

const InputBar = ({ value, onChange, onSend, onOpenSheet, onFocus, onBlur, focused }) => {
  const hasText = value.trim().length > 0;
  const showSend = hasText || focused;
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
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSend(); } }}
        />
        <div className="sc-input-right">
          <div className={`sc-input-icons ${showSend ? "hidden" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="6" y="2" width="6" height="9" rx="3" stroke="#AFAFAF" strokeWidth="1.5"/><path d="M3 9a6 6 0 0012 0M9 15v2M6 17h6" stroke="#AFAFAF" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="2" stroke="#AFAFAF" strokeWidth="1.5"/><circle cx="6.5" cy="7.5" r="1.3" fill="#AFAFAF"/><path d="M2.5 13l4-4 4 4 2-2 3 3" stroke="#AFAFAF" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#AFAFAF" strokeWidth="1.5"/><path d="M9 6v6M6 9h6" stroke="#AFAFAF" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <button
            className={`sc-send-btn ${showSend ? "visible" : ""} ${hasText ? "active" : ""}`}
            onClick={onSend}
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 13V3M3 7l4-4 4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

const RelationshipChart = () => (
  <div className="sc-rel-chart">
    <svg viewBox="0 0 280 90" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#E8A94A" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#E8A94A" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <line x1="20" y1="56" x2="260" y2="56" stroke="rgba(232,169,74,0.2)" strokeWidth="0.5" strokeDasharray="3,3"/>
      <line x1="20" y1="42" x2="260" y2="42" stroke="rgba(61,170,130,0.2)" strokeWidth="0.5" strokeDasharray="3,3"/>
      <line x1="20" y1="28" x2="260" y2="28" stroke="rgba(91,140,245,0.2)" strokeWidth="0.5" strokeDasharray="3,3"/>
      <path d="M 20 65.52 Q 50 61 80 57.68 Q 110 53 140 48.72 Q 170 43 200 39.2 Q 230 34 260 29.68 L 260 70 L 20 70 Z" fill="url(#areaGrad)"/>
      <path d="M 20 65.52 Q 50 61 80 57.68 Q 110 53 140 48.72 Q 170 43 200 39.2 Q 230 34 260 29.68" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <circle cx="20"  cy="65.52" r="3"   fill="#5B8CF5"/>
      <circle cx="80"  cy="57.68" r="3"   fill="#3DAA82"/>
      <circle cx="140" cy="48.72" r="2.5" fill="#DDDBD8"/>
      <circle cx="200" cy="39.2"  r="3"   fill="#E8A94A"/>
      <circle cx="260" cy="29.68" r="4"   fill="#1A1A1A"/>
      <text x="260" y="22" fill="#1A1A1A" fontFamily="DM Sans, sans-serif" fontSize="10" fontWeight="600" textAnchor="middle">72</text>
      {[["20","Apr 3"],["80","Apr 5"],["140","Apr 10"],["200","Apr 15"],["260","Today"]].map(([x,t]) => (
        <text key={t} x={x} y="84" fill="#AFAFAF" fontFamily="DM Sans, sans-serif" fontSize="9" textAnchor="middle">{t}</text>
      ))}
    </svg>
  </div>
);

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

const ContextDrawer = ({ open, onClose, profile, voltz, onDraftConfirmation }) => (
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
            Strong match — shared VC network, both focused on AI infrastructure, one mutual connection at Index.
          </div>
          <div className="sc-stage-pill-wrap"><span className="sc-stage-pill-lg">Warm reply</span></div>
        </DrawerSection>

        <DrawerSection label="Relationship strength" withDivider>
          <div className="sc-rel-number">72</div>
          <div className="sc-rel-status">Growing</div>
          <div className="sc-rel-submetrics">
            <div>
              <span className="sc-rel-metric-label">Last contact</span>
              <span className="sc-rel-metric-value">3d ago</span>
            </div>
            <div>
              <span className="sc-rel-metric-label">Exchanges</span>
              <span className="sc-rel-metric-value">7</span>
            </div>
            <div>
              <span className="sc-rel-metric-label">Response rate</span>
              <span className="sc-rel-metric-value">100%</span>
            </div>
          </div>
          <div className="sc-voltz-line">
            This relationship has earned you <strong>{voltz} voltz</strong>
          </div>
        </DrawerSection>

        <DrawerSection label="Breakdown">
          <BreakdownBar dim="background" label="Background" value={92} />
          <BreakdownBar dim="goals"      label="Goals"      value={88} />
          <BreakdownBar dim="network"    label="Network fit" value={97} />
          <BreakdownBar dim="stage"      label="Stage align" value={74} />
        </DrawerSection>

        <DrawerSection label="Relationship over time">
          <RelationshipChart />
          <div className="sc-rel-transitions">
            <span className="sc-rel-transition"><span className="sc-rel-transition-dot" style={{ background: "#5B8CF5" }}/>Outreach sent · Apr 3</span>
            <span className="sc-rel-transition"><span className="sc-rel-transition-dot" style={{ background: "#3DAA82" }}/>Replied · Apr 3</span>
            <span className="sc-rel-transition"><span className="sc-rel-transition-dot" style={{ background: "#E8A94A" }}/>Warm · Apr 15</span>
          </div>
        </DrawerSection>

        <DrawerSection label="Signals">
          <div className="sc-drawer-signals-grid">
            {[
              ["#3DAA82", "Compatibility match"],
              ["#5B8CF5", "Shared background"],
              ["#9B7CF6", "Network fit"],
              ["#E8A94A", "Recently active"]
            ].map(([c, l]) => (
              <div key={l} className="sc-drawer-signal-item">
                <span className="sc-drawer-signal-dot" style={{ background: c }} />{l}
              </div>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection label="Outreach">
          {[
            ["#5B8CF5", "AI cold message sent", "Apr 3"],
            ["#3DAA82", "Replied — warm", "Apr 3"],
            ["#E8A94A", "3 exchanges active today", "Today"]
          ].map(([color, label, date], i) => (
            <div key={i} className="sc-timeline-item">
              <div className="sc-timeline-left">
                <div className="sc-timeline-dot" style={{ background: color }} />
                <div className="sc-timeline-line" />
              </div>
              <div className="sc-timeline-content">
                <div className="sc-timeline-label">{label}</div>
                <div className="sc-timeline-date">{date}</div>
              </div>
            </div>
          ))}
        </DrawerSection>

        <DrawerSection label="Relationship">
          <Milestone status="done"    label="Cold outreach sent"  date="Apr 3" />
          <Milestone status="done"    label="First reply received" date="Apr 3" />
          <Milestone status="pending" label="Call booked"         date="Thu Apr 24" />
          <Milestone status="locked"  label="Coffee done"         date="—" />
          <Milestone status="locked"  label="Introduction made"   date="—" />
        </DrawerSection>

        <DrawerSection>
          <div className="sc-next-step">
            <div className="sc-next-step-top">
              <BoltIcon />
              <span className="sc-drawer-label" style={{ marginBottom: 0 }}>Suggested next step</span>
            </div>
            <div className="sc-next-step-body">
              Confirm Thursday's call and send your deck beforehand. Reference the LSE alumni connection.
            </div>
            <button className="sc-next-step-cta" onClick={onDraftConfirmation}>Draft confirmation ›</button>
          </div>
        </DrawerSection>

        <DrawerSection label="Notes">
          <div className="sc-note-entry">
            <div className="sc-note-date">Apr 3 · Initial reply</div>
            <div className="sc-note-body">
              Sarah mentioned she's been tracking AI infra for 6 months. Liked the specificity of the cold email. Seemed genuinely curious about the wedge.
            </div>
          </div>
          <div className="sc-note-entry">
            <div className="sc-note-date">Notes from Thursday's call will appear here</div>
            <div className="sc-note-body" style={{ color: "#AFAFAF", fontStyle: "italic" }}>—</div>
          </div>
        </DrawerSection>

      </div>
    </div>
  </>
);

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
  input, setInput, inputFocused, setInputFocused,
  onSend, onOpenSheet, onFillInput,
  drawerOpen, setDrawerOpen, onDraftConfirmation,
  sheetOpen, onCloseSheet, onUseDraft,
  voltzToast,
  previewMode, onAccept, onDecline, declined, onUndo,
  voltz
}) => (
  <div className={`sc-screen sc-screen-chat ${active ? "active" : ""} ${previewMode ? "preview" : ""}`}>
    <VoltzToast amount={voltzToast.amount} visible={voltzToast.visible} />

    <ChatHeader
      profile={profile}
      onBack={onBack}
      onOpenDrawer={() => setDrawerOpen(true)}
      activeChip={activeChip}
      onChipClick={onChipClick}
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
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          focused={inputFocused}
        />
      </>
    )}

    <AISheet open={sheetOpen} onClose={onCloseSheet} onUseDraft={onUseDraft} />
    <ContextDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      profile={profile}
      voltz={voltz}
      onDraftConfirmation={onDraftConfirmation}
    />
  </div>
);

// ============================================================================
// ROOT
// ============================================================================

export default function SuperchargedInbox() {
  // --- data state ---
  const [conversations] = useState(INITIAL_CONVERSATIONS);
  const [newConnections, setNewConnections] = useState(INITIAL_NEW_CONNECTIONS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  // --- navigation state ---
  const [filter, setFilter] = useState("all");
  const [chatActive, setChatActive] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [legendSeen, setLegendSeenFlag] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLegendSeenFlag(false), 100);
    return () => clearTimeout(t);
  }, []);

  // --- chat state ---
  const SARAH_PROFILE = { initials: "SC", color: AVATAR_COLORS.purple, name: "Sarah Chen", role: "VC Associate · Sequoia", id: "sarah" };
  const [chatProfile, setChatProfile] = useState(SARAH_PROFILE);
  const [messages, setMessages] = useState(SARAH_MESSAGES);
  const [activeChip, setActiveChip] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nextSendFromDraft, setNextSendFromDraft] = useState(false);

  // --- preview state ---
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCardId, setPreviewCardId] = useState(null);
  const [declined, setDeclined] = useState(false);
  const declineTimerRef = useRef(null);

  // --- voltz ---
  const [voltzTotal, setVoltzTotal] = useState(43);
  const [voltzToast, setVoltzToast] = useState({ visible: false, amount: 0 });
  const toastTimerRef = useRef(null);
  const queueRef = useRef([]);
  const queueProcessingRef = useRef(false);

  const showToast = useCallback((amount) => {
    setVoltzToast({ visible: true, amount });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setVoltzToast(t => ({ ...t, visible: false }));
    }, 2600);
  }, []);

  const earnVoltz = useCallback((key) => {
    const amt = VOLTZ_EVENTS[key];
    if (!amt) return;
    setVoltzTotal(v => v + amt);
    // Queue toasts so they don't stomp each other
    queueRef.current.push(amt);
    if (!queueProcessingRef.current) {
      queueProcessingRef.current = true;
      const drain = () => {
        const next = queueRef.current.shift();
        if (next === undefined) { queueProcessingRef.current = false; return; }
        showToast(next);
        setTimeout(drain, 900);
      };
      drain();
    }
  }, [showToast]);

  // --- handlers ---
  const openChat = () => { setChatActive(true); };
  const closeChat = () => {
    setChatActive(false);
    setDrawerOpen(false);
    setSheetOpen(false);
    // If leaving a preview, reset back to Sarah
    setTimeout(() => {
      if (previewMode) {
        setPreviewMode(false);
        setDeclined(false);
        setChatProfile(SARAH_PROFILE);
        setMessages(SARAH_MESSAGES);
        setPreviewCardId(null);
      }
    }, 450);
  };

  const handleOpenConvo = (id) => {
    const c = conversations.find(x => x.id === id);
    if (c) setChatProfile({ initials: c.initials, color: c.color, name: c.name, role: c.role, id: c.id });
    setMessages(SARAH_MESSAGES); // demo: same thread for any row
    setPreviewMode(false);
    openChat();
  };

  const handleOpenMove = (convoId, alsoOpenSheet) => {
    handleOpenConvo(convoId);
    if (alsoOpenSheet) setTimeout(() => setSheetOpen(true), 400);
  };

  const handleNotifClick = (n) => {
    setNotifOpen(false);
    // Map notif to a convo id by initial prefix
    const map = { TH: "tom", ML: "mei", SC: "sarah" };
    const convoId = map[n.initials] || "sarah";
    handleOpenConvo(convoId);
    setTimeout(() => setSheetOpen(true), 400);
  };

  const handleMarkAllRead = () => setNotifications([]);

  const enterPreview = (conn, alsoOpenSheet) => {
    setChatProfile({ initials: conn.initials, color: conn.color, name: conn.name, role: conn.role, id: conn.id });
    setMessages([
      { type: "sep", text: "Earlier today" },
      { type: "in", text: conn.message },
      { type: "hint", text: "You haven't replied yet" }
    ]);
    setPreviewMode(true);
    setDeclined(false);
    setPreviewCardId(conn.id);
    openChat();
    if (alsoOpenSheet) setTimeout(() => setSheetOpen(true), 400);
  };

  const handleAccept = () => {
    setPreviewMode(false);
    setMessages(ms => {
      const withoutHint = ms.filter(m => m.type !== "hint");
      return [...withoutHint, { type: "sep", text: "Conversation accepted · Just now" }];
    });
    // Remove the card from new feed
    if (previewCardId) {
      setNewConnections(ns => ns.filter(n => n.id !== previewCardId));
      setPreviewCardId(null);
    }
    earnVoltz("reply_received");
  };

  const handleDecline = () => {
    setDeclined(true);
    clearTimeout(declineTimerRef.current);
    declineTimerRef.current = setTimeout(() => {
      if (previewCardId) {
        setNewConnections(ns => ns.filter(n => n.id !== previewCardId));
      }
      closeChat();
    }, 3000);
  };

  const handleUndo = () => {
    clearTimeout(declineTimerRef.current);
    setDeclined(false);
  };

  const handleChipClick = (key) => {
    if (activeChip === key) {
      setActiveChip(null);
      setTooltip(null);
    } else {
      setActiveChip(key);
      setTooltip(CHIP_TOOLTIPS[key]);
    }
  };

  const handleTooltipDismiss = () => {
    if (activeChip) {
      setActiveChip(null);
      setTooltip(null);
    }
  };

  const handleSend = () => {
    const v = input.trim();
    if (!v) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages(ms => [...ms, { type: "out", text: v, time, read: false }]);
    setInput("");
    const fromDraft = nextSendFromDraft;
    setNextSendFromDraft(false);
    // Simulate "Read" receipt after 2s
    const index = messages.length;
    setTimeout(() => {
      setMessages(curr => curr.map((m, i) => i === index && m.type === "out" ? { ...m, read: true } : m));
    }, 2000);
    if (fromDraft) earnVoltz("ai_draft_used");
    earnVoltz("message_sent");
  };

  const handleUseDraft = (draft) => {
    setInput(draft);
    setNextSendFromDraft(true);
    setSheetOpen(false);
  };

  const handleDraftConfirmation = () => {
    setDrawerOpen(false);
    setTimeout(() => setSheetOpen(true), 300);
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
              notifications={notifications}
              filter={filter}
              onFilter={setFilter}
              notifOpen={notifOpen}
              setNotifOpen={setNotifOpen}
              legendVisible={!legendSeen && !chatActive}
              setLegendSeen={() => setLegendSeenFlag(true)}
              onOpenConvo={handleOpenConvo}
              onOpenMove={handleOpenMove}
              onOpenNewPreview={(c) => enterPreview(c, false)}
              onOpenNewPreviewWithSheet={(c) => enterPreview(c, true)}
              onNotifClick={handleNotifClick}
              onMarkAllRead={handleMarkAllRead}
            />
            <Chat
              active={chatActive}
              profile={chatProfile}
              messages={messages}
              onBack={closeChat}
              activeChip={activeChip}
              onChipClick={handleChipClick}
              tooltip={tooltip}
              onTooltipDismiss={handleTooltipDismiss}
              input={input}
              setInput={setInput}
              inputFocused={inputFocused}
              setInputFocused={setInputFocused}
              onSend={handleSend}
              onOpenSheet={() => setSheetOpen(true)}
              onFillInput={(t) => setInput(t)}
              drawerOpen={drawerOpen}
              setDrawerOpen={setDrawerOpen}
              onDraftConfirmation={handleDraftConfirmation}
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

/* Filter chips */
.sc-filter-wrap { padding:10px 0 12px; overflow-x:auto; overflow-y:visible; }
.sc-filter-wrap::-webkit-scrollbar { display:none; }
.sc-filter-chips { padding:0 20px; display:flex; gap:10px; width:max-content; min-width:100%; }
.sc-chip { position:relative; overflow:visible; border:1.5px solid var(--sc-text); border-radius:999px; padding:9px 20px; font-weight:500; font-size:14px; color:var(--sc-text); background:var(--sc-bg); white-space:nowrap; cursor:pointer; transition:all 0.18s ease; }
.sc-chip.active { background:var(--sc-text); color:var(--sc-bg); }
.sc-chip-badge { position:absolute; top:-8px; right:-8px; min-width:20px; height:20px; border-radius:999px; background:#D84040; color:#FFFFFF; border:2.5px solid var(--sc-bg); font-weight:600; font-size:11px; display:flex; align-items:center; justify-content:center; padding:0 5px; line-height:1; }
.sc-chip-badge.green { background:var(--sc-success); }

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
.sc-notif-list { max-height:380px; overflow-y:auto; }
.sc-notif-list::-webkit-scrollbar { width:0; }
.sc-notif-item { padding:12px 18px; border-bottom:1px solid var(--sc-border-light); display:flex; gap:12px; align-items:flex-start; cursor:pointer; }
.sc-notif-item:last-child { border-bottom:none; }
.sc-notif-body { flex:1; min-width:0; }
.sc-notif-text { font-weight:400; font-size:13px; color:var(--sc-text2); line-height:1.5; }
.sc-notif-cta { margin-top:8px; border:1.5px solid var(--sc-text); border-radius:999px; padding:6px 14px; font-weight:600; font-size:12px; color:var(--sc-text); background:var(--sc-bg); cursor:pointer; display:inline-block; }
.sc-notif-time { font-weight:400; font-size:11px; color:var(--sc-text3); flex-shrink:0; padding-top:2px; }
.sc-notif-empty { font-weight:400; font-size:13px; color:var(--sc-text3); font-style:italic; text-align:center; padding:20px; }

/* Legend */
.sc-legend-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.15); z-index:500; display:flex; align-items:center; justify-content:center; padding:20px; opacity:0; pointer-events:none; transition:opacity 0.3s ease; }
.sc-legend-overlay.visible { opacity:1; pointer-events:auto; }
.sc-legend-card { background:var(--sc-bg); border:1.5px solid var(--sc-text); border-radius:14px; padding:16px 18px; box-shadow:0 4px 16px rgba(0,0,0,0.08); max-width:280px; width:100%; transform:translateY(-30px); }
.sc-legend-header { font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--sc-text3); margin-bottom:10px; }
.sc-legend-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; }
.sc-legend-item { display:flex; align-items:center; gap:6px; font-weight:400; font-size:12px; color:var(--sc-text2); }
.sc-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.sc-legend-hint { font-weight:400; font-size:11px; color:var(--sc-text3); font-style:italic; margin-top:12px; text-align:center; }

/* Chat header */
.sc-chat-header { padding:10px 20px; border-bottom:1px solid var(--sc-border-light); }
.sc-chat-header-row { display:flex; align-items:center; gap:12px; }
.sc-back-btn { background:none; border:none; font-size:26px; color:var(--sc-text); font-weight:400; padding:6px 10px 6px 0; margin-left:-4px; cursor:pointer; min-height:44px; display:flex; align-items:center; line-height:1; }
.sc-chat-header-info { flex:1; display:flex; align-items:center; gap:10px; min-width:0; }
.sc-chat-header-text { min-width:0; flex:1; }
.sc-chat-name { font-weight:600; font-size:17px; color:var(--sc-text); line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sc-chat-role { font-weight:400; font-size:12px; color:var(--sc-text3); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sc-swipe-hint-hit { padding:8px 4px 8px 12px; margin-right:-4px; min-height:44px; display:flex; align-items:center; cursor:pointer; background:transparent; border:none; }
.sc-swipe-hint { display:flex; align-items:center; gap:4px; border:1.5px solid var(--sc-text); border-radius:999px; padding:5px 10px; background:var(--sc-bg); pointer-events:none; }
.sc-swipe-hint-bar { width:16px; height:2.5px; background:var(--sc-text); border-radius:2px; }
.sc-swipe-hint-chev { font-size:13px; color:var(--sc-text); font-weight:400; line-height:1; }

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
.sc-input-bar { border-top:1px solid var(--sc-border-light); padding:10px 16px 28px; display:flex; align-items:center; gap:10px; background:var(--sc-bg); flex-shrink:0; }
.sc-ai-orb { width:36px; height:36px; border-radius:50%; border:1.5px solid var(--sc-text); background:var(--sc-bg); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.sc-input-field { flex:1; border:1.5px solid var(--sc-text); border-radius:999px; background:var(--sc-bg); padding:4px 4px 4px 16px; display:flex; align-items:center; gap:8px; min-height:40px; position:relative; }
.sc-input-field input { flex:1; border:none; outline:none; background:transparent; font-family:'DM Sans',sans-serif; font-weight:400; font-size:14px; color:var(--sc-text); padding:6px 0; min-width:0; }
.sc-input-field input::placeholder { color:var(--sc-text3); }
.sc-input-right { position:relative; width:36px; height:32px; flex-shrink:0; }
.sc-input-icons { display:flex; gap:10px; align-items:center; padding-right:10px; transition:opacity 0.15s ease; position:absolute; right:0; top:50%; transform:translateY(-50%); }
.sc-input-icons.hidden { opacity:0; pointer-events:none; }
.sc-send-btn { width:32px; height:32px; border-radius:50%; background:#4F7FFA; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; pointer-events:none; transition:opacity 0.15s ease; position:absolute; right:0; top:50%; transform:translateY(-50%); }
.sc-send-btn.visible { opacity:0.3; pointer-events:auto; }
.sc-send-btn.active { opacity:1; }
.sc-send-btn svg { display:block; }

/* Sheet */
.sc-sheet-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); z-index:400; opacity:0; pointer-events:none; transition:opacity 0.38s var(--sc-ease); }
.sc-sheet-overlay.visible { opacity:1; pointer-events:auto; }
.sc-sheet { position:absolute; left:0; right:0; bottom:0; background:var(--sc-bg); border-radius:22px 22px 0 0; box-shadow:0 -4px 24px rgba(0,0,0,0.07); padding:0 20px 36px; z-index:401; transform:translateY(100%); transition:transform 0.38s var(--sc-ease); max-height:85%; overflow-y:auto; }
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
.sc-drawer-scroll { flex:1; overflow-y:auto; padding:20px 20px 40px; }
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
.sc-request-bar { border-top:1px solid var(--sc-border-light); padding:12px 16px 28px; display:flex; gap:10px; background:var(--sc-bg); flex-shrink:0; }
.sc-btn-accept { flex:1; background:var(--sc-text); color:var(--sc-bg); border:none; border-radius:999px; padding:14px 0; font-weight:600; font-size:15px; cursor:pointer; transition:opacity 0.15s ease; }
.sc-btn-accept:hover { opacity:0.82; }
.sc-btn-decline { flex:0 0 auto; background:transparent; color:var(--sc-text3); border:1.5px solid var(--sc-border-light); border-radius:999px; padding:14px 22px; font-weight:400; font-size:15px; cursor:pointer; transition:all 0.15s ease; }
.sc-btn-decline:hover { border-color:var(--sc-text); color:var(--sc-text); }
.sc-decline-confirm { border-top:1px solid var(--sc-border-light); padding:16px 16px 28px; display:flex; align-items:center; justify-content:center; gap:12px; background:var(--sc-bg); flex-shrink:0; }
.sc-decline-confirm-text { font-weight:400; font-size:13px; color:var(--sc-text3); }
.sc-decline-undo { background:none; border:none; font-weight:500; font-size:12px; color:var(--sc-text); text-decoration:underline; text-underline-offset:2px; cursor:pointer; padding:4px; }

/* Voltz toast */
.sc-voltz-toast { position:absolute; top:72px; left:50%; transform:translateX(-50%) translateY(-8px); background:var(--sc-text); color:var(--sc-bg); border-radius:999px; padding:7px 16px; display:flex; align-items:center; gap:6px; font-size:13px; font-weight:500; box-shadow:0 4px 16px rgba(0,0,0,0.15); z-index:100; white-space:nowrap; opacity:0; pointer-events:none; }
.sc-voltz-toast.visible { animation:sc-toastIn 0.3s var(--sc-ease) forwards, sc-toastOut 0.3s ease 2.2s forwards; }
@keyframes sc-toastIn { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
@keyframes sc-toastOut { from { opacity:1; } to { opacity:0; transform:translateX(-50%) translateY(-4px); } }

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
