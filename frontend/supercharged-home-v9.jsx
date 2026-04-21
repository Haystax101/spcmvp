import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#FFFEFD",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6B",
  textTertiary: "#AFAFAF",
  borderInt: "#1A1A1A",
  borderDiv: "#DDDBD8",
  yellow: "#F5C842",
  yellowText: "#8B6800",
  bubble: "#F0EDE8",
  bubbleSoft: "#F7F4F0",
  panelBg: "#F7F4F0",
  red: "#D84040",
  green: "#22A85A",
  dimIdentity: "#5B8CF5",
  dimIntent: "#3DAA82",
  dimResonance: "#9B7CF6",
  dimNetwork: "#E8A94A",
};

/* Playfair headlines need characterful weight; use mixture of 400 + italic */
const FF_DISPLAY = "'Playfair Display', serif";
const FF_UI = "'DM Sans', sans-serif";

/* ------------------------------------------------------------------ */
/* Onboarding & context                                                */
/* ------------------------------------------------------------------ */
const puiIntents = [
  { id: "pre-seed-investors", label: "Pre-seed / seed investors in AI-native consumer products" },
  { id: "ai-infra-founders", label: "Founders building in AI infrastructure at seed stage" },
  { id: "plg-product-leaders", label: "Product leaders who have scaled PLG motions 0 → 1" },
  { id: "lse-alumni-operators", label: "LSE alumni operating at scale in UK tech" },
];

const puiContext = {
  name: "Pui",
  role: "Co-founder & CEO, Supercharged",
  background: "LSE Politics & Economics · incoming McKinsey Business Analyst",
  building:
    "Supercharged — an AI-native professional networking app that surfaces the right people at the right time",
  stage: "pre-seed, 200+ beta users across 8 UK universities",
};

/* ------------------------------------------------------------------ */
/* People — with real photos (Unsplash IDs, swap with your uploads)    */
/* ------------------------------------------------------------------ */
/* Hinge uses tall portraits cropped tight. All photos use the same
   crop aspect (3:4ish) so the card composition is consistent.        */
const photoOf = (id) =>
  `https://images.unsplash.com/${id}?w=800&h=1000&fit=crop&crop=faces&q=80`;

const newConnections = [
  {
    id: "elena",
    name: "Elena Popescu",
    initials: "EP",
    role: "Founder · Meridian AI",
    location: "London · ex-Oxford",
    badge: "OXFORD",
    time: "2h ago",
    compat: 88,
    photo: photoOf("photo-1544005313-94ddf0286df2"),
    accent: "#6B5FD0",
    // Headline = the ONE thing that makes you lean in
    headlineLabel: "I'M BUILDING",
    headline: "An AI research layer that thinks in evidence, not tokens",
    // Small chips — kept to 3, high-signal
    chips: [
      { kind: "network", label: "Index Ventures" },
      { kind: "mutual", label: "3 mutual" },
      { kind: "timing", label: "Shipped v1 last week" },
    ],
    dims: { Identity: 91, Intent: 87, Resonance: 84, Network: 79 },
    message:
      "Hi — came across Supercharged through the Oxford network. The AI-matching angle is exactly what I've been thinking about. Would love to connect.",
    messageTime: "Earlier today",
    whyNow:
      "Elena just closed pre-seed at Index — she is actively seeking design partners this week. The window for a peer conversation is now, not in a month.",
    leadWith:
      "Congrats on the Index round. Saw the v1 ship — curious how you are framing research latency vs. depth. Would you be open to trading notes?",
    shared: [
      {
        type: "people",
        title: "3 mutual connections",
        detail: "Arjun K. (Index), Dr. Halvor (Oxford AI), Mia T. (EF)",
      },
      {
        type: "places",
        title: "Oxford × LSE overlap",
        detail: "Same cohort 2022–24",
      },
      {
        type: "events",
        title: "Both at Slush 2025",
        detail: "Co-attended 2 panels; she spoke on AI-native research",
      },
    ],
    tradeoff:
      "Her focus is research tooling, not consumer AI — overlap is adjacent, not direct. Best angle is peer exchange, not alignment hunt.",
  },
  {
    id: "marcus",
    name: "Marcus Kim",
    initials: "MK",
    role: "Partner · Lightspeed",
    location: "London · ex-NYC",
    badge: "LSE",
    time: "Earlier today",
    compat: 79,
    photo: photoOf("photo-1507003211169-0a1dd7228f2d"),
    accent: "#2EC4B6",
    headlineLabel: "WHAT I'M LOOKING FOR",
    headline:
      "Second-time founders who've survived their first pivot",
    chips: [
      { kind: "network", label: "Lightspeed" },
      { kind: "shared", label: "LSE alum" },
      { kind: "timing", label: "Deploying Q2" },
    ],
    dims: { Identity: 78, Intent: 85, Resonance: 71, Network: 82 },
    message:
      "Your profile came up through Arjun at Index. Building in the professional graph space is something I've been tracking — happy to share notes.",
    messageTime: "Earlier today",
    whyNow:
      "Marcus is actively deploying Q2 — 4 seed checks written in the last 60 days. Conversations now convert to intros, not pipeline memos.",
    leadWith:
      "Thanks for reaching out. Arjun mentioned you're tracking the graph space — would love your read on how much of the defensibility sits in the data vs. the model. Free for 20 min next week?",
    shared: [
      {
        type: "people",
        title: "2 mutual connections",
        detail: "Arjun K. (Index Ventures), Priya S. (Lightspeed associate)",
      },
      {
        type: "places",
        title: "LSE alumni",
        detail: "Econ & Finance 2019–22",
      },
      {
        type: "events",
        title: "Portfolio overlap",
        detail: "Both tracking Index-backed seed AI infra",
      },
    ],
    tradeoff:
      "Marcus is a matcher, not a builder. Come with specific asks — 'who should I meet' beats 'what do you think'.",
  },
  {
    id: "sarah",
    name: "Sarah Chen",
    initials: "SC",
    role: "VC Associate · Sequoia",
    location: "London",
    badge: "LSE",
    time: "3h ago",
    compat: 92,
    photo: photoOf("photo-1580489944761-15a19d654956"),
    accent: "#5B8CF5",
    headlineLabel: "WHAT I CAN'T STOP THINKING ABOUT",
    headline:
      "Whether consumer AI retention is defensible without a social graph",
    chips: [
      { kind: "network", label: "Sequoia" },
      { kind: "mutual", label: "4 mutual" },
      { kind: "timing", label: "Replying live" },
    ],
    dims: { Identity: 94, Intent: 91, Resonance: 88, Network: 90 },
    message:
      "Thursday works — send me the deck and let's find 30 minutes this week. Want to fast-track to a partner meeting if the numbers hold.",
    messageTime: "3 hours ago",
    whyNow:
      "Sarah is online right now and has replied within 4 minutes in her last 6 conversations. This is a live thread — response time compounds.",
    leadWith:
      "Thursday 2pm works. Sending deck now. Quick context: ARR tripled in 90 days off zero paid. Happy to walk the partner through the retention slice first.",
    shared: [
      {
        type: "people",
        title: "4 mutual connections",
        detail: "Arjun K. (Index), Felix O. (a16z), Priya S., David M. (Sequoia)",
      },
      {
        type: "places",
        title: "LSE — same cohort",
        detail: "Econ & Philosophy society",
      },
      {
        type: "events",
        title: "Sequoia Scout shortlist",
        detail: "David M. shared your profile last month",
      },
    ],
    tradeoff:
      "Associates filter, partners decide. Treat this as a partner referral, not a term sheet.",
  },
];

const surfacedForYou = [
  {
    id: "james",
    name: "James Okonkwo",
    initials: "JO",
    role: "Product Lead · Notion",
    location: "London · ex-SF",
    badge: "OXFORD",
    compat: 84,
    photo: photoOf("photo-1531427186611-ecfd6d936c79"),
    accent: "#3DAA82",
    matchedIntentId: "plg-product-leaders",
    // For Surfaced — the headline speaks to WHY Pui would reach out
    hookLabel: "WHY YOU'D WANT TO TALK",
    hook:
      "He scaled Notion's PLG from 500K to 8M. You're running the same play.",
    subhook:
      "Ships weekly. Open to peer DMs in the 5 days after a launch.",
    chips: [
      { kind: "network", label: "Notion" },
      { kind: "mutual", label: "2 mutual · Oxford" },
      { kind: "timing", label: "Posted 2d ago" },
    ],
    dims: { Identity: 82, Intent: 88, Resonance: 79, Network: 76 },
    whyNow:
      "James posted about a new feature ship 2 days ago. Builders are most open to peer DMs right after a launch — the adrenaline window lasts roughly 5 days.",
    leadWith:
      "Saw the launch — the inline AI completion feel is the cleanest I've seen. Quick Q on the retention slice: did surface area help or hurt? I'm wrestling with the same call.",
    shared: [
      {
        type: "people",
        title: "2 mutual connections",
        detail: "Dr. Halvor (Oxford AI), Hannah F. (Notion PM)",
      },
      { type: "places", title: "Oxford alumni", detail: "CS at Oxford" },
      {
        type: "events",
        title: "Ships weekly",
        detail: "4 public launches in 2026",
      },
    ],
    tradeoff:
      "Product leaders at scale get 30+ cold DMs a week. Specific, post-launch technical Q is your best shot.",
  },
  {
    id: "aisha",
    name: "Aisha Nwosu",
    initials: "AN",
    role: "VP Product · Monzo",
    location: "London",
    badge: "LSE",
    compat: 71,
    photo: photoOf("photo-1573496359142-b8d87734a5a2"),
    accent: "#E07A5F",
    matchedIntentId: "plg-product-leaders",
    hookLabel: "WHY NOW",
    hook:
      "She's keynoting PLG Summit next month — and refreshing her 0→1 case studies.",
    subhook:
      "Pre-conference is when product leaders welcome new examples.",
    chips: [
      { kind: "network", label: "Monzo" },
      { kind: "mutual", label: "3 mutual · LSE" },
      { kind: "timing", label: "PLG Summit keynote" },
    ],
    dims: { Identity: 74, Intent: 68, Resonance: 72, Network: 65 },
    whyNow:
      "Aisha is speaking at PLG Summit next month. Pre-conference is when product leaders actively refresh their material and welcome new case studies. Outreach timing is optimal.",
    leadWith:
      "Saw you're speaking at PLG Summit. Working on the same 0→1 problem at Supercharged — would love 20 min to trade notes before your talk, if you're open to it.",
    shared: [
      {
        type: "people",
        title: "3 mutual connections",
        detail: "Rhea O., Tomi A., Kemi L.",
      },
      {
        type: "places",
        title: "LSE — senior to you",
        detail: "Econ, cohort 2011–14",
      },
      {
        type: "events",
        title: "PLG Summit speaker",
        detail: "Next month, Lisbon",
      },
    ],
    tradeoff:
      "She's senior and in fintech — advice will be structural, not tactical. Ask for frameworks, not intros.",
  },
  {
    id: "finn",
    name: "Finn Carroll",
    initials: "FC",
    role: "VC Analyst · a16z",
    location: "London · ex-SF",
    badge: "CAMBRIDGE",
    compat: 65,
    photo: photoOf("photo-1522075469751-3a6694fb2f61"),
    accent: "#E8A94A",
    matchedIntentId: "pre-seed-investors",
    hookLabel: "THE WARMEST PATH TO a16z",
    hook: "Four mutual scouts sit between you — and he runs that programme.",
    subhook:
      "a16z scout sourcing window is live through June. Q3 shifts to portfolio.",
    chips: [
      { kind: "network", label: "a16z · scouts" },
      { kind: "mutual", label: "4 mutual" },
      { kind: "timing", label: "Sourcing Q2" },
    ],
    dims: { Identity: 68, Intent: 62, Resonance: 64, Network: 71 },
    whyNow:
      "a16z scout deals close in Q2. Finn's sourcing window is live through June. After that, attention shifts to portfolio support through Q3.",
    leadWith:
      "Arjun mentioned you as the right person for the scout programme. Supercharged is pre-seed, AI-native consumer, 200+ beta users. Happy to send a 1-pager if you're open.",
    shared: [
      {
        type: "people",
        title: "4 mutual connections",
        detail: "Arjun K., Felix O., Priya S., Lena M.",
      },
      {
        type: "places",
        title: "Cambridge × LSE",
        detail: "Shared Oxbridge Entrepreneurs event Jan 2026",
      },
      {
        type: "events",
        title: "a16z scout programme",
        detail: "Sourcing UK pre-seed through June",
      },
    ],
    tradeoff:
      "Analyst, not partner — he filters, he doesn't fund. Entry into a16z, not the deal itself.",
  },
  {
    id: "mei",
    name: "Mei Lin",
    initials: "ML",
    role: "Founder · Atlas Labs",
    location: "London",
    badge: "IMPERIAL",
    compat: 76,
    photo: photoOf("photo-1494790108377-be9c29b29330"),
    accent: "#22A85A",
    matchedIntentId: "ai-infra-founders",
    hookLabel: "YOUR MIRROR, ONE LAYER DOWN",
    hook:
      "Second-time founder, pre-seed, solo, AI infra. You're both in the same trench.",
    subhook:
      "On platform 5×/week — the peer-support moment is now.",
    chips: [
      { kind: "network", label: "Imperial" },
      { kind: "mutual", label: "1 mutual" },
      { kind: "timing", label: "Active daily" },
    ],
    dims: { Identity: 79, Intent: 74, Resonance: 77, Network: 68 },
    whyNow:
      "Mei is on Supercharged daily this week. Second-time founders often look for peers during the solo pre-seed grind — this is a high-intent moment for connection.",
    leadWith:
      "Both of us are in the solo pre-seed grind in AI. You on retrieval, me on the people-graph side. Want to swap notes on what's working and what isn't? I'll buy the coffee.",
    shared: [
      {
        type: "people",
        title: "1 mutual connection",
        detail: "Arjun K. (Index Ventures)",
      },
      {
        type: "places",
        title: "Imperial × LSE",
        detail: "South Kensington / Aldwych — 15 min walk",
      },
      {
        type: "events",
        title: "Active weekly",
        detail: "Logs in 5×/week",
      },
    ],
    tradeoff:
      "Adjacent space means philosophical overlap, not strategic. Peer friendship > pipeline.",
  },
];

const DIM_COLORS = {
  Identity: C.dimIdentity,
  Intent: C.dimIntent,
  Resonance: C.dimResonance,
  Network: C.dimNetwork,
};
const DIM_SUBS = {
  Identity: "Who you are",
  Intent: "What you want",
  Resonance: "How you click",
  Network: "Who you both know",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const compatColor = (c) =>
  c >= 85 ? C.green : c >= 70 ? C.dimNetwork : C.textSecondary;
const getIntentLabel = (id) => puiIntents.find((i) => i.id === id)?.label || "";

/* ------------------------------------------------------------------ */
/* Claude API                                                          */
/* ------------------------------------------------------------------ */
async function draftMessageWithClaude(person, context, puiCtx) {
  const systemPrompt = `You are a master of cold professional outreach for ambitious early-career people. You write openers that are specific, human, and earn a reply. Rules:
- Never sound like a template or LinkedIn request
- Reference something concrete about the person (timing, work, connection, context)
- End with one clear ask, never more
- Keep under 80 words
- Match the register of someone sophisticated — never gushing, never stiff
- No em dashes
- Don't start with "Hi [name]" — start with substance`;

  const contextBlock =
    context === "accept"
      ? `This is a REPLY. The other person wrote first. Match their energy and make the conversation go somewhere specific.\n\nThey wrote:\n"${person.message}"`
      : `This is a COLD OUTREACH. The AI surfaced this person because they match Pui's stated intent. The message IS the connection request.`;

  const userPrompt = `About me (the sender):
- ${puiCtx.name}, ${puiCtx.role}
- ${puiCtx.background}
- Building: ${puiCtx.building}
- Stage: ${puiCtx.stage}

About them (the recipient):
- ${person.name}, ${person.role}
- Based in ${person.location}
- Why this timing matters: ${person.whyNow}
- Tradeoff to be honest about: ${person.tradeoff}

${contextBlock}

Write one message. Return ONLY the message text, no preamble, no quotes, no explanation.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) throw new Error("API request failed");
  const data = await response.json();
  return data.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim()
    .replace(/^["']|["']$/g, "");
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */
const StatusBar = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 52,
      padding: "18px 28px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: FF_UI,
      fontWeight: 600,
      fontSize: 15,
      color: C.textPrimary,
      zIndex: 200,
      background: C.bg,
      pointerEvents: "none",
    }}
  >
    <span>9:41</span>
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
        <rect x="0" y="7" width="3" height="4" rx="0.5" fill="#1A1A1A" />
        <rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="#1A1A1A" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="#1A1A1A" />
        <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="#1A1A1A" />
      </svg>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <path
          d="M8 10.5C8.55 10.5 9 10.05 9 9.5S8.55 8.5 8 8.5 7 8.95 7 9.5 7.45 10.5 8 10.5Z"
          fill="#1A1A1A"
        />
        <path
          d="M3.5 6C4.8 4.8 6.3 4.2 8 4.2C9.7 4.2 11.2 4.8 12.5 6"
          stroke="#1A1A1A"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M1 3.5C3 1.7 5.4 0.8 8 0.8C10.6 0.8 13 1.7 15 3.5"
          stroke="#1A1A1A"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="#1A1A1A" fill="none" />
        <rect x="2" y="2" width="16" height="8" rx="1.2" fill="#1A1A1A" />
        <rect x="22.5" y="4" width="1.5" height="4" rx="0.5" fill="#1A1A1A" />
      </svg>
    </div>
  </div>
);

const BoltIcon = ({ size = 12, fill = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

function CountUp({ target, suffix = "", style = {} }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [target]);
  return (
    <span style={style}>
      {display}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
const Header = () => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    style={{
      padding: "16px 20px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    }}
  >
    <div>
      <div
        style={{
          fontFamily: FF_DISPLAY,
          fontWeight: 300,
          fontSize: 32,
          lineHeight: 1.1,
          color: C.textPrimary,
          letterSpacing: "-0.015em",
        }}
      >
        Good morning, Pui
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: FF_UI,
          fontWeight: 500,
          fontSize: 15,
          color: C.textPrimary,
        }}
      >
        3 people are waiting for you
      </div>
    </div>
    <div
      style={{
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        cursor: "pointer",
        marginRight: -10,
        marginTop: -2,
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.textPrimary}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: C.yellow,
          border: `1.5px solid ${C.bg}`,
        }}
      />
    </div>
  </motion.div>
);

/* ------------------------------------------------------------------ */
/* Network Pulse — left-aligned, backed panel                          */
/* ------------------------------------------------------------------ */
const NetworkPulse = () => {
  const stats = [
    { num: 47, suffix: "", label: "Active connections", delta: "+12 this month", pos: true },
    { num: 89, suffix: "%", label: "Avg compatibility", delta: "+3 pts", pos: true },
    { num: 68, suffix: "%", label: "Response rate", delta: "−4 pts", pos: false },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 24, padding: "0 20px" }}
    >
      <div
        style={{
          fontFamily: FF_UI,
          fontWeight: 500,
          fontSize: 11,
          color: C.textSecondary,
          letterSpacing: "0.08em",
        }}
      >
        NETWORK PULSE
      </div>
      <div
        style={{
          marginTop: 10,
          padding: "18px 18px 16px",
          background: C.panelBg,
          borderRadius: 18,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
            style={{
              gridRow: 1,
              gridColumn: i + 1,
              fontFamily: FF_DISPLAY,
              fontWeight: 300,
              fontSize: 32,
              color: C.textPrimary,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textAlign: "left",
            }}
          >
            <CountUp target={s.num} suffix={s.suffix} />
          </motion.div>
        ))}
        {stats.map((s, i) => (
          <div
            key={`l${i}`}
            style={{
              gridRow: 2,
              gridColumn: i + 1,
              marginTop: 6,
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 11.5,
              color: C.textSecondary,
              lineHeight: 1.3,
              textAlign: "left",
              paddingRight: 6,
            }}
          >
            {s.label}
          </div>
        ))}
        {stats.map((s, i) => (
          <motion.div
            key={`d${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
            style={{ gridRow: 3, gridColumn: i + 1, marginTop: 8, textAlign: "left" }}
          >
            <span
              style={{
                display: "inline-block",
                fontFamily: FF_UI,
                fontWeight: 600,
                fontSize: 10.5,
                borderRadius: 999,
                padding: "3px 9px",
                lineHeight: 1.3,
                background: s.pos ? "rgba(34,168,90,0.12)" : "rgba(216,64,64,0.10)",
                color: s.pos ? C.green : C.red,
                whiteSpace: "nowrap",
              }}
            >
              {s.delta}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Chip                                                                */
/* ------------------------------------------------------------------ */
const Chip = ({ chip, delay = 0 }) => {
  const dotColors = {
    mutual: C.dimIntent,
    shared: C.dimIdentity,
    network: C.dimResonance,
    timing: C.dimNetwork,
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: `1px solid ${C.borderDiv}`,
        borderRadius: 999,
        padding: "4px 10px",
        fontFamily: FF_UI,
        fontWeight: 500,
        fontSize: 11,
        color: C.textPrimary,
        background: C.bg,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColors[chip.kind] || C.textTertiary,
        }}
      />
      {chip.label}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Card Photo — TALL, Hinge-style                                      */
/* ------------------------------------------------------------------ */
const CardPhoto = ({ p, onTap }) => (
  <div
    onClick={onTap}
    style={{
      position: "relative",
      width: "100%",
      height: "65%",
      overflow: "hidden",
      flexShrink: 0,
      cursor: "pointer",
      background: p.accent,
    }}
  >
    <img
      src={p.photo}
      alt={p.name}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center top",
        display: "block",
      }}
      onError={(e) => {
        // fallback to initials block if photo fails
        e.target.style.display = "none";
      }}
    />
    {/* Top gradient for badge legibility */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 100%)",
        pointerEvents: "none",
      }}
    />
    {/* Bottom gradient for name legibility */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(to bottom, transparent 55%, rgba(15,15,15,0.72) 100%)",
        pointerEvents: "none",
      }}
    />
    {/* Badge — institution */}
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        background: C.yellow,
        color: C.yellowText,
        fontFamily: FF_UI,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.06em",
        borderRadius: 999,
        padding: "5px 12px",
      }}
    >
      {p.badge}
    </div>
    {/* Time (top-left, only if present) */}
    {p.time && (
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          fontFamily: FF_UI,
          fontWeight: 500,
          fontSize: 11,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: "0.02em",
        }}
      >
        {p.time}
      </div>
    )}
    {/* Name + role bottom-left */}
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 18,
        right: 18,
        color: "#fff",
      }}
    >
      <div
        style={{
          fontFamily: FF_DISPLAY,
          fontWeight: 400,
          fontSize: 26,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
        }}
      >
        {p.name}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: FF_UI,
          fontWeight: 400,
          fontSize: 12.5,
          color: "rgba(255,255,255,0.82)",
        }}
      >
        {p.role} · {p.location}
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* New Connection Card — Hinge-inspired                                */
/* ------------------------------------------------------------------ */
const NewConnectionCard = ({ p, onAccept, onDecline, onOpenCompat }) => (
  <>
    <CardPhoto p={p} onTap={onOpenCompat} />
    <div
      style={{
        flex: 1,
        padding: "18px 20px 18px",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        minHeight: 0,
      }}
    >
      {/* Small caps label */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{
          fontFamily: FF_UI,
          fontWeight: 600,
          fontSize: 10,
          color: C.textSecondary,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {p.headlineLabel}
      </motion.div>
      {/* Big editorial headline */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.22 }}
        style={{
          marginTop: 6,
          fontFamily: FF_DISPLAY,
          fontWeight: 400,
          fontSize: 22,
          color: C.textPrimary,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
        }}
      >
        {p.headline}
      </motion.div>
      {/* Chips */}
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {p.chips.map((c, i) => (
          <Chip key={i} chip={c} delay={0.3 + i * 0.04} />
        ))}
      </div>
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <CardButton variant="secondary" onClick={onDecline}>
          Decline
        </CardButton>
        <CardButton variant="primary" onClick={onAccept}>
          Accept
        </CardButton>
      </div>
    </div>
  </>
);

/* ------------------------------------------------------------------ */
/* Surfaced Card — same visual language, different framing             */
/* ------------------------------------------------------------------ */
const SurfacedCard = ({ p, onSkip, onConnect, onOpenCompat }) => (
  <>
    <CardPhoto p={p} onTap={onOpenCompat} />
    <div
      style={{
        flex: 1,
        padding: "18px 20px 18px",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        minHeight: 0,
      }}
    >
      {/* Matches your intent — as the label */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        style={{
          fontFamily: FF_UI,
          fontWeight: 600,
          fontSize: 10,
          color: C.green,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <BoltIcon size={10} />
        {p.hookLabel}
      </motion.div>
      {/* Hook — big editorial */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          marginTop: 6,
          fontFamily: FF_DISPLAY,
          fontWeight: 400,
          fontSize: 20,
          color: C.textPrimary,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}
      >
        {p.hook}
      </motion.div>
      {/* Sub-hook — context line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.28 }}
        style={{
          marginTop: 8,
          fontFamily: FF_UI,
          fontWeight: 400,
          fontSize: 12.5,
          color: C.textSecondary,
          lineHeight: 1.45,
        }}
      >
        {p.subhook}
      </motion.div>
      {/* Intent reveal — subtle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.34 }}
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px dashed ${C.borderDiv}`,
          fontFamily: FF_UI,
          fontWeight: 400,
          fontSize: 11,
          color: C.textTertiary,
          lineHeight: 1.4,
        }}
      >
        Matches your intent:{" "}
        <span style={{ color: C.textPrimary, fontWeight: 500 }}>
          {getIntentLabel(p.matchedIntentId)}
        </span>
      </motion.div>
      {/* Chips */}
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {p.chips.map((c, i) => (
          <Chip key={i} chip={c} delay={0.4 + i * 0.04} />
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <CardButton variant="secondary" onClick={onSkip}>
          Skip
        </CardButton>
        <CardButton variant="primary" onClick={onConnect}>
          Connect
        </CardButton>
      </div>
    </div>
  </>
);

/* ------------------------------------------------------------------ */
/* CardButton                                                          */
/* ------------------------------------------------------------------ */
const CardButton = ({ variant, onClick, children }) => {
  const isPrimary = variant === "primary";
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        flex: 1,
        height: 52,
        borderRadius: 999,
        fontFamily: FF_UI,
        fontSize: 15,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isPrimary ? C.textPrimary : C.bg,
        border: isPrimary
          ? `1.5px solid ${C.borderInt}`
          : `1.5px solid ${C.borderDiv}`,
        color: isPrimary ? "#fff" : C.textSecondary,
        fontWeight: isPrimary ? 600 : 500,
      }}
    >
      {children}
    </motion.button>
  );
};

/* ------------------------------------------------------------------ */
/* Card Stack — proper swipe with peek + clean transitions             */
/* ------------------------------------------------------------------ */
const CardStack = ({ deck, tab, onAccept, onConnect, onOpenCompat }) => {
  const [index, setIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-3, 0, 3]);

  useEffect(() => {
    setIndex(0);
  }, [tab]);

  const advance = useCallback(
    (dir) => {
      if (index + dir < 0 || index + dir >= deck.length) {
        animate(x, 0, { type: "spring", stiffness: 400, damping: 32 });
        return;
      }
      setSwipeDir(dir);
      setIndex((i) => i + dir);
      x.set(0);
    },
    [index, deck.length, x]
  );

  const p = deck[index];
  const next = deck[index + 1];

  const handleDragEnd = (_, info) => {
    const off = info.offset.x;
    const vel = info.velocity.x;
    if (Math.abs(off) > 90 || Math.abs(vel) > 500) {
      advance(off < 0 ? 1 : -1);
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 32 });
    }
  };

  return (
    <div style={{ padding: "16px 20px 24px", position: "relative" }}>
      <div style={{ position: "relative", width: "100%", height: 620 }}>
        {/* Peek card underneath */}
        {next && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              right: 8,
              bottom: 0,
              borderRadius: 20,
              background: C.bg,
              border: `1.5px solid ${C.borderDiv}`,
              transform: "scale(0.96)",
              opacity: 0.6,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <img
              src={next.photo}
              alt=""
              style={{
                width: "100%",
                height: "65%",
                objectFit: "cover",
                objectPosition: "center top",
                display: "block",
                filter: "blur(1px)",
              }}
            />
          </div>
        )}

        <AnimatePresence custom={swipeDir} initial={false}>
          <motion.div
            key={`${tab}-${index}`}
            custom={swipeDir}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={handleDragEnd}
            style={{
              x,
              rotate,
              touchAction: "pan-y",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
            initial={(d) =>
              d === 0
                ? { opacity: 0, scale: 0.98, x: 0 }
                : { x: d > 0 ? 360 : -360, opacity: 0, scale: 0.98 }
            }
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={(d) => ({
              x: d > 0 ? -380 : 380,
              opacity: 0,
              rotate: d > 0 ? -6 : 6,
              transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
            })}
            transition={{
              x: { type: "spring", stiffness: 320, damping: 34 },
              opacity: { duration: 0.25 },
              scale: { duration: 0.3 },
            }}
          >
            <div
              style={{
                width: "100%",
                height: 620,
                borderRadius: 20,
                overflow: "hidden",
                background: C.bg,
                border: `1.5px solid ${C.borderInt}`,
                display: "flex",
                flexDirection: "column",
                willChange: "transform, opacity",
              }}
            >
              {tab === "new" ? (
                <NewConnectionCard
                  p={p}
                  onAccept={() => onAccept(p)}
                  onDecline={() => advance(1)}
                  onOpenCompat={() => onOpenCompat(p)}
                />
              ) : (
                <SurfacedCard
                  p={p}
                  onSkip={() => advance(1)}
                  onConnect={() => onConnect(p)}
                  onOpenCompat={() => onOpenCompat(p)}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
        }}
      >
        {deck.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              width: i === index ? 24 : 6,
              background: i === index ? C.textPrimary : C.borderDiv,
            }}
            transition={{ duration: 0.25 }}
            style={{ height: 6, borderRadius: 999 }}
          />
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Compatibility Screen                                                */
/* ------------------------------------------------------------------ */
const CompatScreen = ({ person, fromChat, onClose, onCTA }) => {
  if (!person) return null;

  const iconFor = (type) => {
    if (type === "people")
      return (
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke={C.textPrimary}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="8" r="4" />
          <circle cx="17" cy="10" r="3" />
          <path d="M2 20c0-4 3-6 7-6s7 2 7 6" />
          <path d="M15 20c0-2 2-3.5 4-3.5" />
        </svg>
      );
    if (type === "places")
      return (
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke={C.textPrimary}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke={C.textPrimary}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
      </svg>
    );
  };

  const radialData = [
    { name: "compat", value: person.compat, fill: compatColor(person.compat) },
  ];
  const barData = Object.entries(person.dims).map(([name, value]) => ({
    name,
    value,
    fill: DIM_COLORS[name],
  }));

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        inset: 0,
        background: C.bg,
        borderRadius: 44,
        overflow: "hidden",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StatusBar />
      <div
        style={{
          position: "relative",
          padding: "52px 20px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            position: "absolute",
            left: 12,
            top: 52,
            width: 44,
            height: 44,
            background: "none",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.textPrimary}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </motion.button>
        <div
          style={{
            fontFamily: FF_UI,
            fontWeight: 600,
            fontSize: 17,
            color: C.textPrimary,
            lineHeight: 1.2,
          }}
        >
          {person.name}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: FF_UI,
            fontWeight: 400,
            fontSize: 13,
            color: C.textSecondary,
          }}
        >
          {person.role}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            height: 140,
            position: "relative",
          }}
        >
          <ResponsiveContainer width={140} height={140}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="75%"
              outerRadius="100%"
              barSize={10}
              data={radialData}
              startAngle={90}
              endAngle={90 - (person.compat / 100) * 360}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: "rgba(26,26,26,0.06)" }}
                dataKey="value"
                cornerRadius={999}
                isAnimationActive={true}
                animationDuration={900}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontFamily: FF_DISPLAY,
                fontWeight: 300,
                fontSize: 34,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: compatColor(person.compat),
              }}
            >
              <CountUp target={person.compat} suffix="%" />
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: FF_UI,
                fontWeight: 500,
                fontSize: 12,
                color: C.textSecondary,
                letterSpacing: "0.05em",
              }}
            >
              match
            </div>
          </div>
        </motion.div>

        <SectionLabel label="WHY NOW" />
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          style={{
            marginTop: 14,
            padding: 14,
            background: C.bubbleSoft,
            borderRadius: 14,
            border: "1px solid rgba(232,169,74,0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: FF_UI,
              fontWeight: 600,
              fontSize: 11,
              color: C.yellowText,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <BoltIcon size={12} />
            TIMING SIGNAL
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 13,
              color: C.textPrimary,
              lineHeight: 1.5,
            }}
          >
            {person.whyNow}
          </div>
        </motion.div>

        <SectionLabel label="LEAD WITH" help="Suggested opener" />
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.32 }}
          style={{
            marginTop: 12,
            padding: 14,
            background: C.bg,
            border: `1.5px solid ${C.borderInt}`,
            borderRadius: 14,
          }}
        >
          <div
            style={{
              fontFamily: FF_UI,
              fontWeight: 600,
              fontSize: 11,
              color: C.textSecondary,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            SUPERCHARGED AI
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: FF_DISPLAY,
              fontWeight: 400,
              fontSize: 15,
              color: C.textPrimary,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            "{person.leadWith}"
          </div>
        </motion.div>

        <SectionLabel label="COMPATIBILITY BREAKDOWN" help="4 dimensions" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}
        >
          {barData.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.45 + i * 0.08 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: FF_UI,
                      fontWeight: 600,
                      fontSize: 14,
                      color: C.textPrimary,
                    }}
                  >
                    {d.name}
                  </span>
                  <span
                    style={{
                      fontFamily: FF_UI,
                      fontWeight: 400,
                      fontSize: 11,
                      color: C.textTertiary,
                    }}
                  >
                    {DIM_SUBS[d.name]}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: FF_UI,
                    fontWeight: 700,
                    fontSize: 14,
                    color: d.fill,
                  }}
                >
                  <CountUp target={d.value} />
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(26,26,26,0.06)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${d.value}%` }}
                  transition={{
                    duration: 0.9,
                    delay: 0.5 + i * 0.1,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    height: 6,
                    background: d.fill,
                    borderRadius: 999,
                  }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <SectionLabel label="SHARED CONTEXT" />
        <div style={{ marginTop: 10 }}>
          {person.shared.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.7 + i * 0.08 }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 0",
                borderBottom:
                  i === person.shared.length - 1 ? "none" : `1px solid ${C.bubble}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: C.bubble,
                }}
              >
                {iconFor(s.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FF_UI,
                    fontWeight: 600,
                    fontSize: 13,
                    color: C.textPrimary,
                    lineHeight: 1.3,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: FF_UI,
                    fontWeight: 400,
                    fontSize: 12,
                    color: C.textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  {s.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1 }}
          style={{
            marginTop: 12,
            padding: "12px 14px",
            background: C.bubbleSoft,
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.textSecondary}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div
            style={{
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 12,
              color: C.textSecondary,
              lineHeight: 1.45,
              fontStyle: "italic",
            }}
          >
            {person.tradeoff}
          </div>
        </motion.div>
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: `1px solid ${C.borderDiv}`,
          padding: "16px 20px 36px",
          background: C.bg,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onCTA}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 999,
            fontFamily: FF_UI,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: fromChat ? C.yellow : C.textPrimary,
            color: fromChat ? C.textPrimary : "#fff",
            border: `1.5px solid ${C.borderInt}`,
          }}
        >
          {fromChat && <BoltIcon size={13} />}
          {fromChat ? "Reply with AI" : "Send a message"}
        </motion.button>
      </div>
    </motion.div>
  );
};

const SectionLabel = ({ label, help }) => (
  <div
    style={{
      marginTop: 28,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: FF_UI,
      fontWeight: 500,
      fontSize: 11,
      color: C.textSecondary,
      letterSpacing: "0.08em",
    }}
  >
    <span>{label}</span>
    {help && (
      <span
        style={{
          fontWeight: 400,
          fontSize: 10,
          color: C.textTertiary,
          letterSpacing: 0,
          textTransform: "none",
        }}
      >
        {help}
      </span>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* ACCEPT SCREEN — the chat conversation IS the accept moment          */
/* Directly inspired by the Elena reference image                      */
/* ------------------------------------------------------------------ */
const AcceptChatScreen = ({ person, onClose, onDecline, onAccept, onOpenCompat }) => {
  if (!person) return null;

  // Match chips from reference: context pills under progress
  const contextPills = [
    "Both LSE",
    "AI infra focus",
    "Mutual at Index",
    person.badge,
  ];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        inset: 0,
        background: C.bg,
        borderRadius: 44,
        overflow: "hidden",
        zIndex: 28,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StatusBar />
      {/* Top bar */}
      <div
        style={{
          padding: "52px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          background: C.bg,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            background: "none",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.textPrimary}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </motion.button>
        {/* Avatar */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: FF_UI,
            fontWeight: 600,
            fontSize: 14,
            background: person.accent,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <img
            src={person.photo}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <span
            style={{
              position: "absolute",
              fontFamily: FF_UI,
              fontWeight: 600,
              fontSize: 14,
              color: "#fff",
            }}
          >
            {person.initials}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FF_UI,
              fontWeight: 600,
              fontSize: 17,
              color: C.textPrimary,
              lineHeight: 1.2,
            }}
          >
            {person.name}
          </div>
          <div
            style={{
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 13,
              color: C.textSecondary,
              lineHeight: 1.2,
              marginTop: 1,
            }}
          >
            {person.role}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onOpenCompat}
          style={{
            border: `1.5px solid ${C.borderDiv}`,
            borderRadius: 999,
            padding: "8px 14px",
            background: C.bg,
            fontFamily: FF_UI,
            fontWeight: 500,
            fontSize: 13,
            color: C.textSecondary,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            height: 36,
          }}
        >
          <div
            style={{
              width: 14,
              height: 3,
              background: C.textSecondary,
              borderRadius: 999,
            }}
          />
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.textSecondary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </motion.button>
      </div>

      {/* Progress strip */}
      <div style={{ padding: "0 20px 10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            height: 3,
          }}
        >
          {[1, 1, 0, 0, 0].map((active, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background: active ? C.textPrimary : C.borderDiv,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontFamily: FF_UI,
            fontWeight: 400,
            fontSize: 11,
            color: C.textTertiary,
          }}
        >
          <span>First reply</span>
          <span>Call booked</span>
        </div>
      </div>

      {/* Context pills — horizontal scroll */}
      <div
        style={{
          padding: "10px 20px 12px",
          display: "flex",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
          borderBottom: `1px solid ${C.borderDiv}`,
        }}
      >
        {contextPills.map((label, i) => (
          <div
            key={i}
            style={{
              border: `1.5px solid ${C.borderInt}`,
              borderRadius: 999,
              padding: "6px 14px",
              fontFamily: FF_UI,
              fontWeight: 500,
              fontSize: 13,
              color: C.textPrimary,
              background: C.bg,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Warning banner */}
      <div
        style={{
          padding: "12px 20px",
          background: "rgba(245,200,66,0.12)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          borderBottom: `1px solid rgba(245,200,66,0.2)`,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.yellowText}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>
        <div
          style={{
            fontFamily: FF_UI,
            fontWeight: 400,
            fontSize: 13,
            color: C.yellowText,
            lineHeight: 1.4,
          }}
        >
          They can't see you've opened this yet. Accept to start the conversation.
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px 20px",
          background: C.bg,
        }}
      >
        {/* Date separator */}
        <div
          style={{
            textAlign: "center",
            fontFamily: FF_UI,
            fontWeight: 400,
            fontSize: 12,
            color: C.textTertiary,
            marginBottom: 20,
          }}
        >
          {person.messageTime}
        </div>

        {/* Message bubble */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            maxWidth: "82%",
          }}
        >
          <div
            style={{
              background: C.bubble,
              borderRadius: "18px 18px 18px 4px",
              padding: "14px 16px",
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 14.5,
              color: C.textPrimary,
              lineHeight: 1.55,
            }}
          >
            {person.message}
          </div>
          <div
            style={{
              marginTop: 6,
              width: 26,
              height: 26,
              borderRadius: "50%",
              overflow: "hidden",
              background: person.accent,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={person.photo}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <span
              style={{
                position: "absolute",
                fontFamily: FF_UI,
                fontWeight: 600,
                fontSize: 9,
                color: "#fff",
              }}
            >
              {person.initials}
            </span>
          </div>
        </motion.div>

        {/* Status */}
        <div
          style={{
            textAlign: "center",
            marginTop: 28,
            fontFamily: FF_UI,
            fontWeight: 400,
            fontSize: 13,
            color: C.textTertiary,
          }}
        >
          You haven't replied yet
        </div>
      </div>

      {/* Action row at bottom */}
      <div
        style={{
          flexShrink: 0,
          borderTop: `1px solid ${C.borderDiv}`,
          padding: "14px 16px 32px",
          display: "flex",
          gap: 12,
          background: C.bg,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onDecline}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 999,
            background: C.bg,
            border: `1.5px solid ${C.borderDiv}`,
            fontFamily: FF_UI,
            fontWeight: 500,
            fontSize: 15,
            color: C.textTertiary,
            cursor: "pointer",
          }}
        >
          Decline
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onAccept}
          style={{
            flex: 1.4,
            height: 52,
            borderRadius: 999,
            background: C.textPrimary,
            border: "none",
            fontFamily: FF_UI,
            fontWeight: 600,
            fontSize: 15,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Accept
        </motion.button>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Compose screen — used for Accept→Reply AND for Connect              */
/* ------------------------------------------------------------------ */
const Compose = ({ person, context, onClose, onSend }) => {
  const [text, setText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  if (!person) return null;
  const canSend = text.length >= 20 && !drafting;

  const handleDraft = async () => {
    setDrafting(true);
    setStreamingText("");
    setText("");
    try {
      const draft = await draftMessageWithClaude(person, context, puiContext);
      for (let i = 1; i <= draft.length; i++) {
        setStreamingText(draft.slice(0, i));
        await new Promise((r) => setTimeout(r, 8));
      }
      setText(draft);
      setStreamingText("");
    } catch (e) {
      setText(person.leadWith);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        inset: 0,
        background: C.bg,
        borderRadius: 44,
        overflow: "hidden",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StatusBar />
      <div
        style={{
          padding: "52px 12px 12px",
          borderBottom: `1px solid ${C.borderDiv}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: C.bg,
          flexShrink: 0,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            width: 44,
            height: 44,
            background: "none",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.textPrimary}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </motion.button>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 44px",
          }}
        >
          <div
            style={{
              fontFamily: FF_UI,
              fontWeight: 600,
              fontSize: 15,
              color: C.textPrimary,
              lineHeight: 1.2,
            }}
          >
            {context === "accept"
              ? `Reply to ${person.name.split(" ")[0]}`
              : `Reach out to ${person.name.split(" ")[0]}`}
          </div>
          <div
            style={{
              marginTop: 1,
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 12,
              color: C.textSecondary,
            }}
          >
            {context === "accept"
              ? "Your reply opens the conversation"
              : "Your message is your connection request"}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: canSend ? 0.96 : 1 }}
          onClick={() => canSend && onSend(text, context)}
          disabled={!canSend}
          style={{
            background: canSend ? C.textPrimary : C.borderDiv,
            color: canSend ? "#fff" : C.textTertiary,
            border: "none",
            borderRadius: 999,
            fontFamily: FF_UI,
            fontWeight: 600,
            fontSize: 13,
            padding: "8px 16px",
            cursor: canSend ? "pointer" : "not-allowed",
            height: 36,
          }}
        >
          Send
        </motion.button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 14,
            borderBottom: `1px solid ${C.borderDiv}`,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              overflow: "hidden",
              background: person.accent,
              flexShrink: 0,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={person.photo}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <span
              style={{
                position: "absolute",
                fontFamily: FF_UI,
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
              }}
            >
              {person.initials}
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: FF_UI,
                fontWeight: 600,
                fontSize: 15,
                color: C.textPrimary,
              }}
            >
              {person.name}
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: FF_UI,
                fontWeight: 400,
                fontSize: 12,
                color: C.textSecondary,
              }}
            >
              {person.role} · {person.location}
            </div>
          </div>
        </div>

        {context === "accept" && (
          <div
            style={{
              marginTop: 14,
              background: C.bubble,
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontFamily: FF_UI,
                fontWeight: 600,
                fontSize: 10,
                color: C.textSecondary,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              THEY WROTE
            </div>
            <div
              style={{
                fontFamily: FF_UI,
                fontWeight: 400,
                fontSize: 13,
                color: C.textPrimary,
                lineHeight: 1.5,
              }}
            >
              {person.message}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, position: "relative" }}>
          <div
            style={{
              fontFamily: FF_UI,
              fontWeight: 500,
              fontSize: 11,
              color: C.textSecondary,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {context === "accept" ? "YOUR REPLY" : "YOUR MESSAGE"}
          </div>
          <textarea
            value={drafting ? streamingText : text}
            onChange={(e) => !drafting && setText(e.target.value)}
            disabled={drafting}
            placeholder={
              context === "accept"
                ? "Write a response that matches their energy..."
                : "Lead with context — why them, why now, what you're asking."
            }
            style={{
              width: "100%",
              minHeight: 140,
              border: `1.5px solid ${C.borderDiv}`,
              borderRadius: 16,
              padding: "14px 16px",
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 14,
              lineHeight: 1.5,
              color: C.textPrimary,
              background: C.bg,
              outline: "none",
              resize: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 14,
              fontFamily: FF_UI,
              fontWeight: 400,
              fontSize: 10,
              color: C.textTertiary,
            }}
          >
            {(drafting ? streamingText : text).length} / 500
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleDraft}
            disabled={drafting}
            style={{
              width: "100%",
              height: 44,
              background: drafting ? C.bubbleSoft : C.yellow,
              border: `1.5px solid ${C.borderInt}`,
              borderRadius: 999,
              fontFamily: FF_UI,
              fontWeight: 600,
              fontSize: 13,
              color: C.textPrimary,
              cursor: drafting ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {drafting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{
                    width: 12,
                    height: 12,
                    border: `1.5px solid ${C.textPrimary}`,
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                  }}
                />
                Drafting...
              </>
            ) : (
              <>
                <BoltIcon size={12} />
                Draft with AI
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Sent                                                                */
/* ------------------------------------------------------------------ */
const Sent = ({ context, person, onDone }) => {
  if (!person) return null;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        inset: 0,
        background: C.bg,
        borderRadius: 44,
        overflow: "hidden",
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StatusBar />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
        }}
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.1, 1], opacity: 1 }}
          transition={{ duration: 0.55, times: [0, 0.7, 1] }}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: C.green,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.polyline
              points="20 6 9 17 4 12"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            />
          </motion.svg>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          style={{
            marginTop: 20,
            fontFamily: FF_DISPLAY,
            fontWeight: 300,
            fontSize: 26,
            color: C.textPrimary,
            textAlign: "center",
          }}
        >
          {context === "accept" ? "Reply sent" : "Request sent"}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.65 }}
          style={{
            marginTop: 8,
            fontFamily: FF_UI,
            fontWeight: 400,
            fontSize: 14,
            color: C.textSecondary,
            textAlign: "center",
            maxWidth: 280,
            lineHeight: 1.45,
          }}
        >
          {context === "accept"
            ? `${person.name.split(" ")[0]} will be notified. Your reply is live in the conversation.`
            : `${person.name.split(" ")[0]} will receive your request. You'll be notified when they respond.`}
        </motion.div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          onClick={onDone}
          style={{
            width: "100%",
            maxWidth: 280,
            height: 48,
            marginTop: 24,
            background: C.textPrimary,
            color: "#fff",
            border: "none",
            borderRadius: 999,
            fontFamily: FF_UI,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Back to Home
        </motion.button>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Bottom Nav                                                          */
/* ------------------------------------------------------------------ */
const BottomNav = () => {
  const icons = [
    {
      label: "Home",
      active: true,
      svg: <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z" />,
    },
    {
      label: "Discover",
      svg: (
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      ),
    },
    {
      label: "Inbox",
      badge: 4,
      svg: (
        <>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </>
      ),
    },
    {
      label: "Network",
      svg: (
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <line x1="8" y1="8" x2="10.5" y2="15.5" />
          <line x1="16" y1="8" x2="13.5" y2="15.5" />
        </>
      ),
    },
    {
      label: "Profile",
      svg: (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="10" r="3" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </>
      ),
    },
  ];
  return (
    <div
      style={{
        flexShrink: 0,
        height: 83,
        background: C.bg,
        borderTop: `1px solid ${C.borderDiv}`,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-start",
        paddingTop: 10,
        paddingBottom: 34,
        zIndex: 5,
      }}
    >
      {icons.map((it, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 4,
            height: 49,
            cursor: "pointer",
            position: "relative",
            paddingTop: 2,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={it.active ? C.textPrimary : C.textTertiary}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {it.svg}
          </svg>
          <span
            style={{
              fontFamily: FF_UI,
              fontSize: 11,
              color: it.active ? C.textPrimary : C.textTertiary,
              fontWeight: it.active ? 600 : 400,
            }}
          >
            {it.label}
          </span>
          {it.badge && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: "calc(50% - 18px)",
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 999,
                background: C.red,
                color: "#fff",
                fontFamily: FF_UI,
                fontWeight: 600,
                fontSize: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1.5px solid ${C.bg}`,
              }}
            >
              {it.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main App                                                            */
/* ------------------------------------------------------------------ */
export default function App() {
  const [tab, setTab] = useState("new");
  const [compatOpen, setCompatOpen] = useState(false);
  const [compatFromChat, setCompatFromChat] = useState(false);
  const [acceptChatOpen, setAcceptChatOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeContext, setComposeContext] = useState(null);
  const [sentOpen, setSentOpen] = useState(false);
  const [activePerson, setActivePerson] = useState(null);

  const deck = tab === "new" ? newConnections : surfacedForYou;

  const handleAcceptFromCard = (p) => {
    setActivePerson(p);
    setAcceptChatOpen(true);
  };
  const handleConnect = (p) => {
    setActivePerson(p);
    setComposeContext("connect");
    setComposeOpen(true);
  };
  const handleOpenCompat = (p) => {
    setActivePerson(p);
    setCompatFromChat(false);
    setCompatOpen(true);
  };
  // Inside the AcceptChatScreen
  const handleAcceptFromChat = () => {
    setAcceptChatOpen(false);
    setTimeout(() => {
      setComposeContext("accept");
      setComposeOpen(true);
    }, 250);
  };
  const handleDeclineFromChat = () => {
    setAcceptChatOpen(false);
  };
  const handleCompatCTA = () => {
    setCompatOpen(false);
    setTimeout(() => {
      if (newConnections.some((n) => n.id === activePerson?.id)) {
        setAcceptChatOpen(true);
      } else {
        setComposeContext("connect");
        setComposeOpen(true);
      }
    }, 250);
  };
  const handleSend = () => {
    setComposeOpen(false);
    setTimeout(() => setSentOpen(true), 200);
  };
  const handleDone = () => {
    setSentOpen(false);
  };

  useEffect(() => {
    const id = "supercharged-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@300;400;400i&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "20px 0",
        fontFamily: FF_UI,
      }}
    >
      <div
        style={{
          width: 375,
          height: 812,
          background: C.bg,
          position: "relative",
          overflow: "hidden",
          borderRadius: 44,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <StatusBar />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            background: C.bg,
            borderRadius: 44,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingTop: 52,
              scrollbarWidth: "none",
            }}
          >
            <style>{`
              div::-webkit-scrollbar { display: none; }
              textarea { font-family: 'DM Sans', sans-serif !important; }
              textarea::placeholder { color: ${C.textTertiary}; }
              textarea:focus { border-color: ${C.borderInt} !important; }
            `}</style>
            <Header />
            <NetworkPulse />

            {/* Tabs — cleaner, no bottom border */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: C.bg,
                padding: "20px 20px 8px",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {["new", "surfaced"].map((t) => {
                  const active = tab === t;
                  const label = t === "new" ? "New Connections" : "Surfaced For You";
                  const count = t === "new" ? 3 : 4;
                  return (
                    <motion.div
                      key={t}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setTab(t)}
                      style={{
                        position: "relative",
                        borderRadius: 999,
                        padding: "9px 20px",
                        fontFamily: FF_UI,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        height: 40,
                        display: "inline-flex",
                        alignItems: "center",
                        background: active ? C.textPrimary : C.bg,
                        color: active ? "#fff" : C.textPrimary,
                        fontWeight: active ? 600 : 400,
                        border: `1.5px solid ${C.borderInt}`,
                        transition: "background 240ms ease, color 240ms ease",
                      }}
                    >
                      {label}
                      <span
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          minWidth: 18,
                          height: 18,
                          padding: "0 5px",
                          borderRadius: 999,
                          background: C.red,
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: `2px solid ${C.bg}`,
                        }}
                      >
                        {count}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Card stack with smooth tab fade */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              >
                <CardStack
                  deck={deck}
                  tab={tab}
                  onAccept={handleAcceptFromCard}
                  onConnect={handleConnect}
                  onOpenCompat={handleOpenCompat}
                />
              </motion.div>
            </AnimatePresence>
          </div>
          <BottomNav />
        </div>

        <AnimatePresence>
          {compatOpen && (
            <CompatScreen
              person={activePerson}
              fromChat={compatFromChat}
              onClose={() => setCompatOpen(false)}
              onCTA={handleCompatCTA}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {acceptChatOpen && (
            <AcceptChatScreen
              person={activePerson}
              onClose={() => setAcceptChatOpen(false)}
              onDecline={handleDeclineFromChat}
              onAccept={handleAcceptFromChat}
              onOpenCompat={() => {
                setCompatFromChat(true);
                setCompatOpen(true);
              }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {composeOpen && (
            <Compose
              person={activePerson}
              context={composeContext}
              onClose={() => setComposeOpen(false)}
              onSend={handleSend}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {sentOpen && (
            <Sent person={activePerson} context={composeContext} onDone={handleDone} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
