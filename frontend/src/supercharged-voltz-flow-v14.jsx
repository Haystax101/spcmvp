import React, { useState } from "react";

// ============================================================================
// Design tokens
// ============================================================================
const C = {
  bg: "#FFFEFC",
  card: "#FFFEFC",           // cards share the canvas; borders do the work
  cardWarm: "#FAF5E8",       // for Invite Friends, Usage nudge — visibly warmer
  cardTinted: "#F9F6EE",     // subtle tint for the three pulse stat cards
  border: "rgba(0,0,0,0.12)",
  borderStrong: "#1A1A1A",
  text: "#1A1A1A",
  secondary: "#9E9B95",
  muted: "#B0ADA8",
  chevron: "#C0BDB7",
  pill: "#F0ECE4",
  amber: "#F59E0B",
  accentGreen: "#4CAF50",
  greenBg: "#EAF3E0",
  greenText: "#3A7D2B",
  redBg: "#FDEAEA",
  redText: "#C0392B",
  luminaryBg: "#FFF3E0",
  luminaryText: "#B45309",
  zenithBg: "#EDE9FE",
  zenithText: "#5B21B6",
  helpRed: "#E53935",
  inputBg: "#F5F2EA",        // slightly recessed vs. canvas
  inputBorder: "rgba(0,0,0,0.14)",
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

// ============================================================================
// Bonus voltz — 5% on every purchase, priced into the product
// ============================================================================
const getBonusVoltz = (baseVoltz) => Math.floor(baseVoltz * 0.05);

// ============================================================================
// Product catalogue (single source of truth for pricing)
// ============================================================================
const VOLTZ_PACKS = {
  spark: { id: "spark", name: "Spark", voltz: 50, voltzLabel: "50 voltz", price: 1.99, original: 2.99, popular: false },
  flare: { id: "flare", name: "Flare", voltz: 200, voltzLabel: "200 voltz", price: 5.99, original: 7.99, popular: true },
  surge: { id: "surge", name: "Surge", voltz: 500, voltzLabel: "500 voltz", price: 11.99, original: 14.99, popular: false },
};

const PLANS = {
  luminary: {
    id: "luminary",
    name: "Luminary",
    price: 8.99,
    original: 12.99,
    voltzPerMonth: 300,
    voltzLabel: "300 voltz / month",
    bonusVoltz: 15,
    context: "≈ 30 AI searches / month",
    features: [
      "Up to 100 AI searches / month",
      "Priority matching",
      "Message analytics",
      "Advanced compatibility scoring",
    ],
  },
  zenith: {
    id: "zenith",
    name: "Zenith",
    price: 19.99,
    original: 24.99,
    voltzPerMonth: 1000,
    voltzLabel: "1,000 voltz / month",
    bonusVoltz: 50,
    context: "≈ unlimited feel",
    features: [
      "Unlimited AI searches",
      "External web search",
      "Advanced compatibility scoring",
      "Early access features",
      "Priority support",
    ],
  },
};

// ============================================================================
// Usage data (mock)
// ============================================================================
const USAGE_DATA = {
  totalSpent: 47,
  period: "This month",
  remaining: 20,
  total: 67,
  breakdown: [
    { action: "AI message drafts", voltz: 18, count: 9, icon: "bolt", color: "#F59E0B" },
    { action: "Compatibility scans", voltz: 14, count: 7, icon: "scan", color: "#4CAF50" },
    { action: "External searches", voltz: 10, count: 5, icon: "search", color: "#5B21B6" },
    { action: "Profile insights", voltz: 5, count: 5, icon: "profile", color: "#9E9B95" },
  ],
};

// ============================================================================
// Confetti particle config (fixed, deterministic — no Math.random at render)
// ============================================================================
const CONFETTI_COLORS = ["#4CAF50", "#F59E0B", "#5B21B6", "#E53935", "#1A1A1A"];
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => {
  // Spread x across 0-100%, vary shapes/delays/rotations deterministically
  const x = (i * 17 + 7) % 100; // 0..99
  const delay = ((i * 53) % 120) / 100; // 0..1.19s
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  const isSquare = i % 3 === 0;
  const width = isSquare ? 6 : 8;
  const height = isSquare ? 6 : 3;
  const rotation = (i * 37) % 360;
  const duration = 2.2 + ((i * 13) % 10) / 10; // 2.2..3.1s
  return { x, delay, color, width, height, rotation, duration };
});

// ============================================================================
// Icons — all inline SVG
// ============================================================================
const BoltIcon = ({ size = 16, color = C.amber }) => (
  <svg
    width={size * 0.72}
    height={size}
    viewBox="0 0 13 18"
    fill="none"
    style={{ display: "block" }}
  >
    <path
      d="M7.5 1L1 10.5H6.5L5.5 17L12 7.5H6.5L7.5 1Z"
      fill={color}
      stroke={color}
      strokeWidth="0.3"
      strokeLinejoin="round"
    />
  </svg>
);

const IconSearch = ({ size = 22, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="20" y1="20" x2="15.5" y2="15.5" />
  </svg>
);

const IconChevronLeft = ({ size = 24, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 6 9 12 15 18" />
  </svg>
);

const IconChevronRight = ({ size = 18, color = C.chevron }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

const IconExternal = ({ size = 16, color = C.chevron }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="9 7 17 7 17 15" />
  </svg>
);

const IconGear = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconEnvelope = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3 7 12 13 21 7" />
  </svg>
);

const IconHelp = ({ size = 20, color = C.helpRed }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
    <line x1="12" y1="17" x2="12" y2="17.01" />
  </svg>
);

const IconCheck = ({ size = 16, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: 2 }}>
    <polyline points="4 12 10 18 20 6" />
  </svg>
);

const IconArrowRight = ({ size = 14, color = C.secondary }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="13 6 19 12 13 18" />
  </svg>
);

const IconGlobe = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <path d="M12 3 A14 14 0 0 1 12 21 A14 14 0 0 1 12 3 Z" />
  </svg>
);

const IconLock = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11 V7 a4 4 0 0 1 8 0 V11" />
  </svg>
);

const IconShield = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z" />
  </svg>
);

const IconSignOut = ({ size = 20, color = C.helpRed }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4 H19 A1 1 0 0 1 20 5 V19 A1 1 0 0 1 19 20 H15" />
    <polyline points="10 8 4 12 10 16" />
    <line x1="4" y1="12" x2="15" y2="12" />
  </svg>
);

const IconStar = ({ size = 12, color = C.amber }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "inline-block", verticalAlign: "-1px" }}>
    <path d="M12 2 L14.9 8.6 L22 9.5 L16.7 14.3 L18.2 21.3 L12 17.8 L5.8 21.3 L7.3 14.3 L2 9.5 L9.1 8.6 Z" />
  </svg>
);

const IconEye = ({ size = 18, color = C.secondary }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ size = 18, color = C.secondary }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.5 10.5 0 0 1 12 20C5 20 1 12 1 12a19.7 19.7 0 0 1 4.22-5.94" />
    <path d="M9.9 5.24A9.1 9.1 0 0 1 12 5c7 0 11 7 11 7a19.7 19.7 0 0 1-3.17 4.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconScan = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V4a1 1 0 011-1h3" />
    <path d="M13 3h3a1 1 0 011 1v3" />
    <path d="M17 13v3a1 1 0 01-1 1h-3" />
    <path d="M7 17H4a1 1 0 01-1-1v-3" />
  </svg>
);

const IconProfile = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="7" r="3" />
    <path d="M4 18 a6 6 0 0 1 12 0" />
  </svg>
);

const IconShieldLock = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z" />
    <rect x="9.5" y="11" width="5" height="4" rx="0.6" />
    <path d="M10.5 11 V9.5 a1.5 1.5 0 0 1 3 0 V11" />
  </svg>
);

// Status bar
const SignalBars = () => (
  <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
    <rect x="0" y="8" width="2.6" height="3" rx="0.4" fill={C.text} />
    <rect x="3.8" y="6" width="2.6" height="5" rx="0.4" fill={C.text} />
    <rect x="7.6" y="3" width="2.6" height="8" rx="0.4" fill={C.text} />
    <rect x="11.4" y="0" width="2.6" height="11" rx="0.4" fill={C.text} />
  </svg>
);
const WifiIcon = () => (
  <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
    <path d="M7.5 9.7 L9.6 7.6 A3 3 0 0 0 5.4 7.6 Z" fill={C.text} />
    <path d="M2.6 5.2 A6.9 6.9 0 0 1 12.4 5.2" stroke={C.text} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M0.4 2.7 A10 10 0 0 1 14.6 2.7" stroke={C.text} strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);
const BatteryIcon = () => (
  <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
    <rect x="0.5" y="0.5" width="22" height="11" rx="2.8" stroke={C.text} strokeOpacity="0.4" fill="none" />
    <rect x="2" y="2" width="19" height="8" rx="1.6" fill={C.text} />
    <rect x="23.5" y="4" width="1.8" height="4" rx="0.6" fill={C.text} fillOpacity="0.4" />
  </svg>
);

// ============================================================================
// Reusable pieces
// ============================================================================
const StatusBar = () => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 24px 0 24px",
    fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.text,
  }}>
    <span>9:41</span>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <SignalBars /> <WifiIcon /> <BatteryIcon />
    </div>
  </div>
);

const SectionLabel = ({ children, color, style }) => (
  <div style={{
    fontFamily: SANS, fontSize: 11, fontWeight: 600,
    letterSpacing: "0.10em", textTransform: "uppercase",
    color: color || C.secondary, ...style,
  }}>
    {children}
  </div>
);

const Divider = ({ style }) => (
  <div style={{ height: 1, background: C.border, ...style }} />
);

const PlanBadge = ({ kind }) => {
  const map = {
    Free: { bg: C.pill, text: C.secondary },
    Luminary: { bg: C.luminaryBg, text: C.luminaryText },
    Zenith: { bg: C.zenithBg, text: C.zenithText },
  };
  const s = map[kind];
  return (
    <span style={{
      background: s.bg, color: s.text, borderRadius: 999,
      padding: "4px 10px", fontSize: 11, fontWeight: 500,
      fontFamily: SANS, display: "inline-block",
    }}>
      {kind}
    </span>
  );
};

const DeltaPill = ({ value, tone }) => {
  const pos = tone === "positive";
  return (
    <span style={{
      display: "inline-block",
      background: pos ? C.greenBg : C.redBg,
      color: pos ? C.greenText : C.redText,
      borderRadius: 999, padding: "5px 10px",
      fontSize: 12, fontWeight: 500, fontFamily: SANS,
    }}>
      {value}
    </span>
  );
};

const PrimaryPill = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    background: C.borderStrong, color: "#FFFFFF", border: "none",
    borderRadius: 999, padding: "13px 24px",
    fontSize: 14, fontWeight: 500, fontFamily: SANS,
    cursor: "pointer", ...style,
  }}>
    {children}
  </button>
);

const OutlinePill = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    background: "transparent", border: `1.5px solid ${C.borderStrong}`,
    color: C.text, borderRadius: 999, padding: "13px 24px",
    fontSize: 14, fontWeight: 500, fontFamily: SANS,
    cursor: "pointer", ...style,
  }}>
    {children}
  </button>
);

// Compact voltz nav pill
const VoltzNavPill = ({ count, onClick }) => (
  <button onClick={onClick} style={{
    background: C.card, border: `1.5px solid ${C.borderStrong}`,
    borderRadius: 999, padding: "5px 10px 5px 5px",
    display: "inline-flex", alignItems: "center",
    cursor: "pointer", lineHeight: 1,
  }}>
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      background: C.accentGreen, color: "#FFFFFF",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: SANS, fontSize: 10, fontWeight: 600,
    }}>
      B
    </div>
    <div style={{ width: 5 }} />
    <BoltIcon size={14} />
    <div style={{ width: 3 }} />
    <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text }}>
      {count}
    </span>
  </button>
);

const TopNav = ({ title, onBack, titleLeading }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center", padding: "16px 20px",
  }}>
    <div>
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", display: "inline-flex",
        }}>
          <IconChevronLeft />
        </button>
      )}
    </div>
    <div style={{
      fontFamily: SERIF, fontSize: 20, color: C.text, textAlign: "center",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {titleLeading}
      <span>{title}</span>
    </div>
    <div />
  </div>
);

// ============================================================================
// Price display with strikethrough
// ============================================================================
const PriceBlock = ({ price, original, suffix, alignRight = false, big = false }) => (
  <div style={{
    display: "flex", flexDirection: "column",
    alignItems: alignRight ? "flex-end" : "flex-start",
    lineHeight: 1,
  }}>
    <span style={{
      fontFamily: SANS, fontSize: 11, color: C.muted,
      textDecoration: "line-through", marginBottom: 4,
    }}>
      ${original.toFixed(2)}
    </span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{
        fontFamily: SERIF, fontSize: big ? 36 : 20, fontWeight: 600,
        color: C.text, letterSpacing: big ? "-0.01em" : "0",
      }}>
        ${price.toFixed(2)}
      </span>
      {suffix && (
        <span style={{ fontFamily: SANS, fontSize: big ? 14 : 12, color: C.secondary }}>
          {suffix}
        </span>
      )}
    </div>
  </div>
);

// ============================================================================
// Plan cards (shared, with Zenith fixes applied)
// ============================================================================
const PlanCard = ({ plan, variant, onUpgrade, activePlan }) => {
  const isZenith = variant === "zenith";
  const isCurrent = activePlan === plan.id;
  const isDowngrade = activePlan === "zenith" && plan.id === "luminary";

  const ctaLabel = isCurrent
    ? "Current plan"
    : isDowngrade
      ? `Switch to ${plan.name}`
      : `Upgrade to ${plan.name}`;

  return (
    <div style={{
      background: C.card, borderRadius: 16,
      border: `1.5px solid ${C.borderStrong}`,
      padding: 20,
    }}>
      {/* Header: plan name + (for Zenith) Popular badge inline */}
      {isZenith ? (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          marginBottom: 8,
        }}>
          <span style={{ fontFamily: SERIF, fontSize: 22, color: C.text }}>Zenith</span>
          <span style={{
            background: C.zenithBg, color: C.zenithText,
            borderRadius: 999, fontSize: 11, fontWeight: 600,
            padding: "4px 10px", marginTop: 2, fontFamily: SANS,
          }}>
            Popular
          </span>
        </div>
      ) : (
        <div style={{ fontFamily: SERIF, fontSize: 22, color: C.text }}>{plan.name}</div>
      )}

      {/* Price with strikethrough */}
      <div style={{ marginTop: isZenith ? 0 : 8 }}>
        <PriceBlock price={plan.price} original={plan.original} suffix="/month" big />
      </div>

      {/* Voltz per month */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <BoltIcon size={14} />
        <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>
          {plan.voltzLabel}
        </span>
      </div>

      {/* Context line — makes voltz quantity concrete */}
      <div style={{
        fontFamily: SANS, fontSize: 11, color: C.muted, marginTop: 4,
      }}>
        {plan.context}
      </div>

      <Divider style={{ marginTop: 14, marginBottom: 14 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <IconCheck />
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
              {f}
            </span>
          </div>
        ))}
      </div>

      {/* CTA — active plan is a disabled "Current plan" chip */}
      {isCurrent ? (
        <div style={{
          width: "100%", marginTop: 20,
          padding: "13px 24px",
          borderRadius: 999,
          background: "transparent",
          border: `1.5px solid ${C.divider}`,
          color: C.secondary,
          fontSize: 14, fontWeight: 500, fontFamily: SANS,
          textAlign: "center",
          cursor: "default",
        }}>
          Current plan
        </div>
      ) : (
        <PrimaryPill
          style={{ width: "100%", marginTop: 20 }}
          onClick={() => onUpgrade && onUpgrade(plan)}
        >
          {ctaLabel}
        </PrimaryPill>
      )}
    </div>
  );
};

// ============================================================================
// Screen 1 — Home
// ============================================================================
const HomeScreen = ({ onOpenVoltz, voltzBalance }) => {
  const pulse = [
    { stat: "47", label: "Connections", delta: "+12 this month", tone: "positive" },
    { stat: "89%", label: "Avg compatibility", delta: "+3 pts", tone: "positive" },
    { stat: "68%", label: "Response rate", delta: "–4 pts", tone: "negative" },
  ];
  const waiting = [
    { initials: "EP", name: "Emma Park", meta: "Replied to your intro · 2h ago", bg: "#D8C8F0", fg: "#6B4FA0" },
    { initials: "HP", name: "Henry Patel", meta: "Opened compatibility profile · 4h ago", bg: "#B8E0D8", fg: "#2D7A6B" },
    { initials: "MO", name: "Maya Okonkwo", meta: "Accepted your request · Yesterday", bg: "#C8DFB8", fg: "#3D6B2A" },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />

      <div style={{
        display: "flex", justifyContent: "flex-end", alignItems: "center",
        padding: "12px 20px", gap: 14,
      }}>
        <button aria-label="Search" style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", display: "inline-flex",
        }}>
          <IconSearch />
        </button>
        <VoltzNavPill count={voltzBalance} onClick={onOpenVoltz} />
      </div>

      <div style={{ padding: "24px 20px 8px 20px" }}>
        <h1 style={{
          fontFamily: SERIF, fontSize: 36, fontWeight: 400,
          color: C.text, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em",
        }}>
          Good morning, Pui
        </h1>
        <p style={{
          fontFamily: SANS, fontSize: 16, color: C.secondary,
          margin: "6px 0 0 0",
        }}>
          3 people are waiting for you
        </p>
      </div>

      <div style={{ padding: "0 20px", marginTop: 28 }}>
        <SectionLabel>Network Pulse</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {pulse.map(p => (
            <div key={p.label} style={{
              flex: 1, background: C.cardTinted, borderRadius: 16,
              border: `1px solid ${C.border}`, padding: 16,
            }}>
              <div style={{
                fontFamily: SERIF, fontSize: 32, color: C.text,
                lineHeight: 1, letterSpacing: "-0.01em",
              }}>
                {p.stat}
              </div>
              <div style={{
                fontFamily: SANS, fontSize: 13, color: C.secondary,
                marginTop: 4, lineHeight: 1.3,
              }}>
                {p.label}
              </div>
              <div style={{ marginTop: 12 }}>
                <DeltaPill value={p.delta} tone={p.tone} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 20px", marginTop: 28, paddingBottom: 40 }}>
        <SectionLabel>Waiting for You</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {waiting.map(w => (
            <div key={w.initials} style={{
              background: C.card, borderRadius: 16,
              border: `1px solid ${C.border}`, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: w.bg, color: w.fg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: SANS, fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>
                {w.initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.text }}>
                  {w.name}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.secondary, marginTop: 2 }}>
                  {w.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 2 — Voltz
// ============================================================================
const VoltzScreen = ({ onBack, onGetMore, onPlans, onSettings, onEmail, onUsage, voltzBalance, activePlan }) => {
  const planKindMap = { luminary: "Luminary", zenith: "Zenith" };
  const planKind = activePlan ? planKindMap[activePlan] : "Free";
  const menu = [
    { key: "usage", label: "Usage",
      icon: <BoltIcon size={20} color={C.amber} />, trailing: "chevron", onClick: onUsage },
    { key: "settings", label: "Settings",
      icon: <IconGear />, trailing: "chevron", onClick: onSettings },
    { key: "email", label: "Email address",
      icon: <IconEnvelope />, trailing: "chevron", onClick: onEmail },
    { key: "help", label: "Get help",
      icon: <IconHelp />, trailing: "external", onClick: () => {} },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav title="Voltz" onBack={onBack} />

      <div style={{ margin: "0 20px" }}>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: C.accentGreen, color: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: SANS, fontSize: 17, fontWeight: 600, flexShrink: 0,
            }}>
              B
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{
                fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                bowencheung...
              </div>
              <div><PlanBadge kind={planKind} /></div>
            </div>
            <button onClick={onPlans} style={{
              background: "transparent", border: `1.5px solid ${C.borderStrong}`,
              color: C.text, borderRadius: 999, padding: "8px 18px",
              fontSize: 13, fontWeight: 500, fontFamily: SANS, cursor: "pointer",
            }}>
              {activePlan ? "Manage" : "Upgrade"}
            </button>
          </div>

          <Divider style={{ margin: "14px 0" }} />

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BoltIcon size={22} />
              <span style={{
                fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: C.text, lineHeight: 1,
              }}>
                {voltzBalance}
              </span>
            </div>
            <button onClick={onGetMore} style={{
              background: "transparent", border: "none", padding: 4,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: SANS, fontSize: 14, color: C.text,
            }}>
              Get more <IconArrowRight color={C.text} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ margin: "16px 20px 0 20px" }}>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, overflow: "hidden",
        }}>
          {menu.map((item, idx) => (
            <div key={item.key} onClick={item.onClick} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "15px 16px", cursor: "pointer",
              borderBottom: idx === menu.length - 1 ? "none" : `1px solid ${C.border}`,
            }}>
              <div style={{
                width: 20, height: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <span style={{
                fontFamily: SANS, fontSize: 15,
                color: item.key === "help" ? C.helpRed : C.text,
              }}>
                {item.label}
              </span>
              <div style={{ marginLeft: "auto", display: "inline-flex" }}>
                {item.trailing === "external" ? <IconExternal /> : <IconChevronRight />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
};

// ============================================================================
// Invite Friends card (shared across Get More and Plans)
// ============================================================================
const InviteCard = () => (
  <div style={{ margin: "8px 20px 0 20px" }}>
    <SectionLabel>Invite friends</SectionLabel>
    <div style={{
      background: "#1A1A1A", borderRadius: 16,
      padding: 20, marginTop: 12,
    }}>
      <div style={{
        fontFamily: SANS, fontSize: 11, fontWeight: 600,
        letterSpacing: "0.10em", textTransform: "uppercase",
        color: C.amber, marginBottom: 8,
      }}>
        Free voltz!
      </div>
      <div style={{
        fontFamily: SERIF, fontSize: 18, color: "#FFFEFC", lineHeight: 1.3,
      }}>
        Invite friends, you both get 100 voltz!
      </div>
      <div style={{
        fontFamily: SANS, fontSize: 13, color: "rgba(255,255,255,0.65)",
        marginTop: 6, lineHeight: 1.4,
      }}>
        Share your personal link and earn every time someone joins.
      </div>
      <div style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 999,
        padding: "10px 16px", fontFamily: MONO, fontSize: 13,
        color: "#FFFEFC", marginTop: 14,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        getsupercharged.app/r/pui
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button style={{
          flex: 1,
          background: "transparent",
          border: "1px solid #FFFEFC",
          color: "#FFFEFC",
          borderRadius: 999,
          padding: "11px 16px",
          fontSize: 13, fontWeight: 500, fontFamily: SANS,
          cursor: "pointer",
        }}>
          Copy link
        </button>
        <button style={{
          flex: 1,
          background: "#FFFEFC",
          border: "none",
          color: "#1A1A1A",
          borderRadius: 999,
          padding: "11px 16px",
          fontSize: 13, fontWeight: 600, fontFamily: SANS,
          cursor: "pointer",
        }}>
          Share
        </button>
      </div>
    </div>
  </div>
);

// ============================================================================
// Screen 3 — Get More
// ============================================================================
const GetMoreScreen = ({ onBack, onBuyPack, onUpgradePlan, activePlan }) => {
  const packs = [VOLTZ_PACKS.spark, VOLTZ_PACKS.flare, VOLTZ_PACKS.surge];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav title="Get voltz" onBack={onBack} />

      {/* INVITE FRIENDS */}
      <InviteCard />

      {/* TOP UP VOLTZ */}
      <div style={{ margin: "24px 20px 0 20px" }}>
        <SectionLabel>Top up voltz</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {packs.map(p => (
            <div key={p.id} style={{
              background: C.card, borderRadius: 16,
              border: `1.5px solid ${C.borderStrong}`,
              borderLeft: p.popular ? `3px solid ${C.accentGreen}` : `1.5px solid ${C.borderStrong}`,
              padding: p.popular ? "36px 20px 18px 20px" : "18px 20px",
              display: "flex", alignItems: "center",
              position: "relative",
            }}>
              {p.popular && (
                <span style={{
                  position: "absolute", top: 12, right: 12,
                  background: C.greenBg, color: C.greenText,
                  borderRadius: 999, padding: "4px 10px",
                  fontSize: 11, fontWeight: 600, fontFamily: SANS,
                }}>
                  Most popular
                </span>
              )}
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 20, color: C.text, lineHeight: 1.1 }}>
                  {p.name}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 5, marginTop: 3,
                }}>
                  <BoltIcon size={14} />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>
                    {p.voltzLabel}
                  </span>
                </div>
              </div>
              <div style={{
                marginLeft: "auto", display: "flex", flexDirection: "column",
                alignItems: "flex-end", gap: 8,
              }}>
                <PriceBlock price={p.price} original={p.original} alignRight />
                <PrimaryPill
                  style={{ padding: "9px 22px", fontSize: 13 }}
                  onClick={() => onBuyPack(p)}
                >
                  Buy
                </PrimaryPill>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* UPGRADE YOUR PLAN */}
      <div style={{ margin: "24px 20px 0 20px", paddingBottom: 40 }}>
        <SectionLabel>Upgrade your plan</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
          <PlanCard plan={PLANS.luminary} variant="luminary" onUpgrade={onUpgradePlan} activePlan={activePlan} />
          <PlanCard plan={PLANS.zenith} variant="zenith" onUpgrade={onUpgradePlan} activePlan={activePlan} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 4 — Plans
// ============================================================================
const PlansScreen = ({ onBack, onUpgradePlan, voltzBalance, activePlan }) => {
  const planKindMap = { luminary: "Luminary", zenith: "Zenith" };
  const planKind = activePlan ? planKindMap[activePlan] : "Free";
  const planLabel = activePlan
    ? `You're on ${planKindMap[activePlan]}`
    : "You're on the Free plan";

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav title="Plans" onBack={onBack} />

      <InviteCard />

      <div style={{ margin: "16px 20px 0 20px" }}>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1.5px solid ${C.borderStrong}`, padding: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: C.accentGreen, color: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: SANS, fontSize: 17, fontWeight: 600, flexShrink: 0,
            }}>
              B
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text }}>
                bowencheung...
              </div>
              <div><PlanBadge kind={planKind} /></div>
            </div>
          </div>

          <Divider style={{ margin: "14px 0" }} />

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.text }}>
              {planLabel}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BoltIcon size={16} />
              <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.text }}>
                {voltzBalance}
              </span>
            </div>
          </div>

          {!activePlan && (
            <>
              <Divider style={{ margin: "14px 0" }} />
              <div style={{
                fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5,
              }}>
                Upgrade to get monthly voltz, unlimited AI searches, and priority matching.
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ margin: "24px 20px 0 20px", paddingBottom: 40 }}>
        <SectionLabel>{activePlan ? "Plans" : "Choose a plan"}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
          <PlanCard plan={PLANS.luminary} variant="luminary" onUpgrade={onUpgradePlan} activePlan={activePlan} />
          <PlanCard plan={PLANS.zenith} variant="zenith" onUpgrade={onUpgradePlan} activePlan={activePlan} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 5 — Settings
// ============================================================================
const Toggle = ({ on, onToggle }) => (
  <div onClick={onToggle} style={{
    width: 44, height: 26, borderRadius: 13,
    background: on ? C.accentGreen : "#D1D1D1",
    position: "relative", cursor: "pointer",
    transition: "background 0.2s",
    flexShrink: 0,
  }}>
    <div style={{
      width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF",
      position: "absolute", top: 3,
      left: on ? 21 : 3,
      transition: "left 0.2s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    }} />
  </div>
);

const SettingsScreen = ({ onBack, onSignOut, onChangePassword }) => {
  const [newConnections, setNewConnections] = useState(true);
  const [messageReplies, setMessageReplies] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const notifications = [
    { label: "New connections", state: newConnections, set: setNewConnections },
    { label: "Message replies", state: messageReplies, set: setMessageReplies },
    { label: "Weekly digest", state: weeklyDigest, set: setWeeklyDigest },
  ];

  const MenuRow = ({ icon, label, trailing, onClick, danger, noChevron }) => (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "15px 16px", cursor: "pointer",
    }}>
      <div style={{
        width: 20, height: 20, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{
        fontFamily: SANS, fontSize: 15,
        fontWeight: danger ? 500 : 400,
        color: danger ? C.helpRed : C.text,
      }}>
        {label}
      </span>
      <div style={{
        marginLeft: "auto", display: "inline-flex",
        alignItems: "center", gap: 8,
      }}>
        {trailing && (
          <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>
            {trailing}
          </span>
        )}
        {!noChevron && <IconChevronRight />}
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav title="Settings" onBack={onBack} />

      {/* Notifications */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Notifications</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, overflow: "hidden",
        }}>
          {notifications.map((n, idx) => (
            <div key={n.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "15px 16px",
              borderBottom: idx === notifications.length - 1 ? "none" : `1px solid ${C.border}`,
            }}>
              <span style={{ fontFamily: SANS, fontSize: 15, color: C.text }}>
                {n.label}
              </span>
              <Toggle on={n.state} onToggle={() => n.set(!n.state)} />
            </div>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div style={{ margin: "16px 20px 0 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Preferences</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, overflow: "hidden",
        }}>
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <MenuRow icon={<IconGlobe />} label="Language" trailing="English" onClick={() => {}} />
          </div>
          <MenuRow icon={<IconLock />} label="Privacy" onClick={() => {}} />
        </div>
      </div>

      {/* Account */}
      <div style={{ margin: "16px 20px 40px 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Account</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, overflow: "hidden",
        }}>
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <MenuRow icon={<IconShieldLock />} label="Change password" onClick={onChangePassword} />
          </div>
          <MenuRow
            icon={<IconSignOut />}
            label="Sign out"
            danger
            noChevron
            onClick={onSignOut}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 6 — Email address
// ============================================================================
const EmailScreen = ({ onBack }) => {
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    border: `1px solid ${C.inputBorder}`,
    fontSize: 15,
    fontFamily: SANS,
    background: C.inputBg,
    outline: "none",
    color: C.text,
    boxSizing: "border-box",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav title="Email address" onBack={onBack} />

      {/* Current email */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Current email</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <div style={{ fontFamily: SANS, fontSize: 15, color: C.text }}>
            bowencheung@gmail.com
          </div>
          <div style={{
            fontFamily: SANS, fontSize: 12, color: C.secondary, marginTop: 4,
          }}>
            Last updated 3 months ago
          </div>
        </div>
      </div>

      {/* Update email */}
      <div style={{ margin: "16px 20px 40px 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Update email</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <input
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Confirm new email address"
            value={confirmEmail}
            onChange={e => setConfirmEmail(e.target.value)}
            style={{ ...inputStyle, marginTop: 10 }}
          />
          <PrimaryPill style={{ width: "100%", marginTop: 16 }}>
            Save changes
          </PrimaryPill>
          <div style={{
            fontFamily: SANS, fontSize: 12, color: C.secondary,
            textAlign: "center", marginTop: 10,
          }}>
            We'll send a confirmation to your new address.
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 7 — Checkout
// ============================================================================
const CheckoutScreen = ({ onBack, context, onComplete, voltzBalance }) => {
  const [quantity, setQuantity] = useState(1);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    border: `1px solid ${C.inputBorder}`,
    fontSize: 15,
    fontFamily: SANS,
    background: C.inputBg,
    outline: "none",
    color: C.text,
    boxSizing: "border-box",
  };

  const formatCardNumber = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const isVoltz = context?.type === "voltz";
  const item = context?.item;

  if (!item) return null;

  const unitPrice = item.price;
  const totalPrice = isVoltz ? unitPrice * quantity : unitPrice;
  const baseVoltz = isVoltz ? item.voltz * quantity : item.voltzPerMonth;
  const bonusVoltz = isVoltz
    ? getBonusVoltz(item.voltz) * quantity
    : (item.bonusVoltz || 0);
  const totalVoltz = baseVoltz + bonusVoltz;

  const StepperButton = ({ children, onClick, filled, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: "50%",
        background: filled ? (disabled ? "#CCCCCC" : C.borderStrong) : "transparent",
        color: filled ? "#FFFFFF" : (disabled ? C.muted : C.text),
        border: filled ? "none" : `1.5px solid ${disabled ? "#CCCCCC" : C.borderStrong}`,
        cursor: disabled ? "default" : "pointer",
        fontSize: 16, fontWeight: 500, fontFamily: SANS,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, lineHeight: 1,
      }}>
      {children}
    </button>
  );

  const handleComplete = () => {
    onComplete({
      type: context.type,
      item,
      quantity: isVoltz ? quantity : 1,
      totalPrice,
      baseVoltz,
      bonusVoltz,
      totalVoltz,
    });
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav
        title="Secure checkout"
        onBack={onBack}
        titleLeading={<IconLock size={12} color={C.secondary} />}
      />

      {/* Order summary */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Your order</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          {/* Item name */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          }}>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 20, color: C.text }}>
                {item.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <BoltIcon size={14} />
                <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>
                  {isVoltz ? item.voltzLabel : item.voltzLabel}
                </span>
              </div>
            </div>
            <PriceBlock
              price={item.price}
              original={item.original}
              suffix={isVoltz ? null : "/month"}
              alignRight
            />
          </div>

          {/* Plan feature summary */}
          {!isVoltz && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {item.features.slice(0, 2).map(f => (
                <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <IconCheck />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                    {f}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quantity (voltz only) */}
          {isVoltz && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 16,
            }}>
              <span style={{ fontFamily: SANS, fontSize: 14, color: C.text }}>Quantity</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StepperButton
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  –
                </StepperButton>
                <span style={{
                  fontFamily: SANS, fontSize: 16, fontWeight: 600,
                  color: C.text, minWidth: 32, textAlign: "center",
                }}>
                  {quantity}
                </span>
                <StepperButton
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  filled
                  disabled={quantity >= 10}
                >
                  +
                </StepperButton>
              </div>
            </div>
          )}

          <Divider style={{ marginTop: 16, marginBottom: 16 }} />

          {/* Total */}
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.secondary }}>Total</span>
            <span style={{
              fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.text,
            }}>
              ${totalPrice.toFixed(2)}{!isVoltz && (
                <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary, fontWeight: 400 }}>/mo</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Payment details */}
      <div style={{ margin: "16px 20px 0 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Payment details</SectionLabel>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <input
            placeholder="Card number"
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            maxLength={19}
            style={{ ...inputStyle, marginBottom: 10 }}
            inputMode="numeric"
          />
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input
              placeholder="MM / YY"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              inputMode="numeric"
            />
            <input
              placeholder="CVV"
              value={cvv}
              onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              style={{ ...inputStyle, flex: 1 }}
              inputMode="numeric"
            />
          </div>
          <input
            placeholder="Name on card"
            value={nameOnCard}
            onChange={e => setNameOnCard(e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {["VISA", "MC", "AMEX"].map(brand => (
              <span key={brand} style={{
                background: "#F5F5F5",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                color: C.secondary,
                fontFamily: SANS,
                letterSpacing: "0.04em",
              }}>
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Pay button */}
      <PrimaryPill
        onClick={handleComplete}
        style={{
          display: "block",
          margin: "20px 20px 0 20px",
          fontSize: 16,
          padding: "16px 24px",
          width: "calc(100% - 40px)",
          boxSizing: "border-box",
        }}
      >
        {isVoltz
          ? `Pay $${totalPrice.toFixed(2)}`
          : `Start plan — $${totalPrice.toFixed(2)}/mo`}
      </PrimaryPill>

      <div style={{
        margin: "12px 20px 40px 20px",
        textAlign: "center",
        fontFamily: SANS, fontSize: 12, color: C.secondary,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      }}>
        <IconLock size={12} color={C.secondary} />
        <span>Your payment is encrypted and secure.</span>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 8 — Confirmation (celebratory)
// ============================================================================
const Confetti = () => (
  <div style={{
    position: "absolute", inset: 0, overflow: "hidden",
    pointerEvents: "none", zIndex: 1,
  }}>
    {CONFETTI_PIECES.map((p, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          top: 0,
          left: `${p.x}%`,
          width: p.width,
          height: p.height,
          background: p.color,
          borderRadius: p.width === p.height ? 1 : 1,
          transform: `rotate(${p.rotation}deg)`,
          animation: `confettiFall ${p.duration}s ${p.delay}s cubic-bezier(0.4, 0, 0.6, 1) forwards`,
          opacity: 0,
        }}
      />
    ))}
  </div>
);

const ConfirmationScreen = ({ result, voltzBalance, onHome }) => {
  if (!result) return null;
  const isVoltz = result.type === "voltz";
  const newBalance = voltzBalance;
  const bonusV = result.bonusVoltz || 0;
  // Primary voltz amount — pack base × quantity, or plan monthly allotment
  const mainVoltz = isVoltz
    ? result.baseVoltz
    : result.item.voltzPerMonth;

  return (
    <div style={{
      height: "100%", overflowY: "auto", background: C.bg,
      position: "relative",
    }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(340px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <Confetti />

      <StatusBar />

      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        minHeight: "80%", padding: "0 24px",
        position: "relative", zIndex: 2,
        paddingTop: 20, paddingBottom: 40,
      }}>
        {/* Hero checkmark */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: C.greenBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          <svg width={32} height={32} viewBox="0 0 32 32" fill="none"
            stroke={C.greenText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 16 L14 22 L24 10" />
          </svg>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: SERIF, fontSize: 28, color: C.text,
          textAlign: "center", lineHeight: 1.2,
          margin: "24px 0 0 0", fontWeight: 400,
        }}>
          {isVoltz ? "Your voltz just landed." : `Welcome to ${result.item.name}.`}
        </h1>

        {/* Subtext */}
        <p style={{
          fontFamily: SANS, fontSize: 15, color: C.secondary,
          textAlign: "center", lineHeight: 1.6,
          maxWidth: 280, margin: "10px 0 0 0",
        }}>
          {isVoltz
            ? `${mainVoltz} voltz added to your balance. Plus ${bonusV} bonus voltz — on us.`
            : `${mainVoltz.toLocaleString()} voltz added. Refreshes monthly. Plus ${bonusV} bonus voltz, one time on us.`}
        </p>

        {/* Voltz breakdown card — primary first, bonus second */}
        <div style={{
          marginTop: 28, width: "100%",
          background: C.card, borderRadius: 16,
          border: `1.5px solid ${C.borderStrong}`, padding: 20,
          animation: "popIn 0.5s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          opacity: 0,
        }}>
          {/* Row 1: Main voltz added (dominant) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            paddingBottom: 14,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "#FFF8E7",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <BoltIcon size={26} color={C.amber} />
            </div>
            <div>
              <div style={{
                fontFamily: SANS, fontSize: 11, fontWeight: 600,
                color: C.secondary, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 3,
              }}>
                Voltz added
              </div>
              <div style={{
                fontFamily: SERIF, fontSize: 32, color: C.text,
                lineHeight: 1, letterSpacing: "-0.01em",
              }}>
                +{mainVoltz.toLocaleString()} voltz
              </div>
              <div style={{
                fontFamily: SANS, fontSize: 12, color: C.secondary, marginTop: 3,
              }}>
                {isVoltz ? "Added to your balance" : "Refreshes every month"}
              </div>
            </div>
          </div>

          {/* Row 2: Bonus voltz (secondary, celebratory) */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: 14,
          }}>
            <div>
              <div style={{
                fontFamily: SANS, fontSize: 11, fontWeight: 600,
                color: C.greenText, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 3,
              }}>
                Free bonus — on us
              </div>
              <div style={{
                fontFamily: SERIF, fontSize: 22, color: C.text, lineHeight: 1.1,
              }}>
                +{bonusV} voltz
              </div>
              <div style={{
                fontFamily: SANS, fontSize: 12, color: C.secondary, marginTop: 2,
              }}>
                as a gift from us!
              </div>
            </div>
            <div style={{
              background: C.greenBg, borderRadius: 999,
              padding: "6px 14px",
            }}>
              <span style={{
                fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.greenText,
              }}>
                Free
              </span>
            </div>
          </div>
        </div>

        {/* New balance pill */}
        <div style={{
          marginTop: 20, background: C.cardTinted,
          border: `1px solid ${C.border}`,
          borderRadius: 999, padding: "10px 20px",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <BoltIcon size={14} />
          <span style={{ fontFamily: SANS, fontSize: 14, color: C.text }}>
            New balance: {newBalance} voltz
          </span>
        </div>

        {/* Back to home */}
        <PrimaryPill
          onClick={onHome}
          style={{
            width: "100%", marginTop: 32, boxSizing: "border-box",
          }}
        >
          Back to home
        </PrimaryPill>

        {!isVoltz && (
          <div style={{
            marginTop: 12,
            fontFamily: SANS, fontSize: 12, color: C.secondary,
            textAlign: "center",
          }}>
            Manage your plan anytime from the Voltz page.
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Screen 9 — Usage
// ============================================================================
const UsageActionIcon = ({ kind }) => {
  if (kind === "bolt") return <BoltIcon size={20} color={C.amber} />;
  if (kind === "scan") return <IconScan />;
  if (kind === "search") return <IconSearch size={20} />;
  if (kind === "profile") return <IconProfile />;
  return null;
};

const UsageScreen = ({ onBack, onTopUp }) => {
  const { totalSpent, total, remaining, breakdown } = USAGE_DATA;
  const progressPct = (remaining / total) * 100;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <StatusBar />
      <TopNav title="Usage" onBack={onBack} />

      {/* Summary card */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>
              This month
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <BoltIcon size={13} />
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text }}>
                {remaining} voltz left
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            width: "100%", height: 6, borderRadius: 999,
            background: "rgba(0,0,0,0.08)", marginTop: 16, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 999,
              background: C.accentGreen,
              width: `${progressPct}%`,
              transition: "width 0.6s ease",
            }} />
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between",
            marginTop: 6,
          }}>
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>0</span>
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>{total} voltz</span>
          </div>

          <Divider style={{ marginTop: 16, marginBottom: 16 }} />

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: C.text }}>
              {totalSpent} voltz spent
            </div>
            <button style={{
              background: "transparent", border: "none", padding: 0,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: SANS, fontSize: 12, color: C.secondary,
            }}>
              View history <IconArrowRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ margin: "24px 20px 0 20px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>Spent by action</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {breakdown.map(item => {
            const pct = Math.round((item.voltz / totalSpent) * 100);
            return (
              <div key={item.action} style={{
                background: C.card, borderRadius: 16,
                border: `1px solid ${C.border}`, padding: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 20, height: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <UsageActionIcon kind={item.icon} />
                  </div>
                  <span style={{
                    fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text,
                  }}>
                    {item.action}
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    fontFamily: SANS, fontSize: 12, color: C.secondary,
                  }}>
                    {item.count} uses
                  </span>
                </div>

                <div style={{
                  width: "100%", height: 5, borderRadius: 999,
                  background: "rgba(0,0,0,0.08)", marginTop: 10, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    background: item.color,
                    width: `${pct}%`,
                    transition: "width 0.6s ease",
                  }} />
                </div>

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  marginTop: 8,
                }}>
                  <span style={{
                    fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text,
                  }}>
                    {item.voltz} voltz
                  </span>
                  <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-up nudge */}
      <div
        onClick={onTopUp}
        style={{
          margin: "20px 20px 40px 20px",
          background: C.cardWarm,
          borderRadius: 16,
          padding: 16,
          display: "flex", alignItems: "center",
          cursor: "pointer",
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "#FFF8E7",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <BoltIcon size={18} />
        </div>
        <div style={{ marginLeft: 12, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text,
          }}>
            Running low?
          </span>
          <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>
            Top up your voltz
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "inline-flex" }}>
          <IconChevronRight />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Screen 10 — Change password
// ============================================================================
const getStrength = (pw) => {
  if (pw.length === 0) return null;
  if (pw.length < 6) return { label: "Too short", color: "#E53935", width: "20%" };
  if (pw.length < 8) return { label: "Weak", color: "#F59E0B", width: "45%" };
  if (!/[0-9]/.test(pw) || !/[A-Z]/.test(pw))
    return { label: "Fair", color: "#F59E0B", width: "65%" };
  return { label: "Strong", color: "#4CAF50", width: "100%" };
};

const ChangePasswordScreen = ({ onBack }) => {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorCurrent, setErrorCurrent] = useState("");
  const [errorMatch, setErrorMatch] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = getStrength(newPw);

  const inputWrapperStyle = { position: "relative", width: "100%" };
  const inputStyle = {
    width: "100%",
    padding: "13px 44px 13px 16px",
    borderRadius: 12,
    border: `1px solid ${C.inputBorder}`,
    fontSize: 15,
    fontFamily: SANS,
    background: C.inputBg,
    outline: "none",
    color: C.text,
    boxSizing: "border-box",
  };
  const eyeBtnStyle = {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    display: "inline-flex",
  };

  const handleSave = () => {
    let ok = true;
    if (!currentPw) {
      setErrorCurrent("Please enter your current password.");
      ok = false;
    } else {
      setErrorCurrent("");
    }
    if (newPw !== confirmPw) {
      setErrorMatch("Passwords don't match.");
      ok = false;
    } else {
      setErrorMatch("");
    }
    if (ok && newPw.length > 0) {
      setSuccess(true);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0 }
          100% { transform: scale(1); opacity: 1 }
        }
      `}</style>
      <StatusBar />
      <TopNav title="Change password" onBack={onBack} />

      {success ? (
        <div style={{ margin: "8px 20px 40px 20px" }}>
          <div style={{
            background: C.card, borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "32px 20px", textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: C.greenBg, margin: "0 auto 20px auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={C.greenText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 12 10 18 20 6" />
              </svg>
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 20, color: C.text }}>
              Password updated
            </div>
            <div style={{
              fontFamily: SANS, fontSize: 13, color: C.secondary,
              marginTop: 8, lineHeight: 1.5,
            }}>
              Your password has been changed successfully.
            </div>
            <OutlinePill
              onClick={onBack}
              style={{ marginTop: 20, padding: "11px 24px", fontSize: 14 }}
            >
              Back to settings
            </OutlinePill>
          </div>
        </div>
      ) : (
        <div style={{ margin: "8px 20px 40px 20px" }}>
          <SectionLabel style={{ marginBottom: 12 }}>Update password</SectionLabel>
          <div style={{
            background: C.card, borderRadius: 16,
            border: `1px solid ${C.border}`, padding: 20,
          }}>
            {/* Current password */}
            <div style={inputWrapperStyle}>
              <input
                type={showCurrent ? "text" : "password"}
                placeholder="Current password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={() => setShowCurrent(s => !s)}
                style={eyeBtnStyle}
                aria-label="Toggle visibility"
              >
                {showCurrent ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {errorCurrent && (
              <div style={{
                fontFamily: SANS, fontSize: 12, color: C.helpRed, marginTop: 6,
              }}>
                {errorCurrent}
              </div>
            )}

            {/* New password */}
            <div style={{ ...inputWrapperStyle, marginTop: 10 }}>
              <input
                type={showNew ? "text" : "password"}
                placeholder="New password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={() => setShowNew(s => !s)}
                style={eyeBtnStyle}
                aria-label="Toggle visibility"
              >
                {showNew ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>

            {strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  height: 3, borderRadius: 999,
                  background: "rgba(0,0,0,0.08)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    background: strength.color,
                    width: strength.width,
                    transition: "width 0.3s ease, background 0.3s ease",
                  }} />
                </div>
                <div style={{
                  fontFamily: SANS, fontSize: 11,
                  color: strength.color, marginTop: 4, fontWeight: 500,
                }}>
                  {strength.label}
                </div>
              </div>
            )}

            {/* Confirm password */}
            <div style={{ ...inputWrapperStyle, marginTop: 10 }}>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={() => setShowConfirm(s => !s)}
                style={eyeBtnStyle}
                aria-label="Toggle visibility"
              >
                {showConfirm ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {errorMatch && (
              <div style={{
                fontFamily: SANS, fontSize: 12, color: C.helpRed, marginTop: 6,
              }}>
                {errorMatch}
              </div>
            )}

            <PrimaryPill
              onClick={handleSave}
              style={{ width: "100%", marginTop: 20 }}
            >
              Save changes
            </PrimaryPill>

            <div style={{
              fontFamily: SANS, fontSize: 12, color: C.secondary,
              textAlign: "center", marginTop: 10, lineHeight: 1.5,
            }}>
              Use 8+ characters with a number and uppercase letter.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// App shell
// ============================================================================
export default function App() {
  const [screen, setScreen] = useState("home");
  const [checkoutContext, setCheckoutContext] = useState(null);
  const [checkoutFrom, setCheckoutFrom] = useState("voltz");
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [voltzBalance, setVoltzBalance] = useState(20);
  const [activePlan, setActivePlan] = useState(null); // null | 'luminary' | 'zenith'

  // Level model for slide transitions:
  // 0 home → 1 voltz → 2 {get-more, plans, settings, email, usage} → 3 {checkout, change-password} → 4 confirmation
  const levelOf = (s) => ({
    home: 0,
    voltz: 1,
    "get-more": 2, plans: 2, settings: 2, email: 2, usage: 2,
    checkout: 3, "change-password": 3,
    confirmation: 4,
  }[s]);

  const currentLevel = levelOf(screen);

  const goToCheckout = (type, item) => {
    setCheckoutContext({ type, item });
    setCheckoutFrom(screen);
    setScreen("checkout");
  };

  const completePurchase = (result) => {
    // Add voltz to balance
    setVoltzBalance(prev => prev + result.totalVoltz);
    // If it's a plan purchase, set the active plan
    if (result.type === "plan") {
      setActivePlan(result.item.id);
    }
    setCheckoutResult(result);
    setScreen("confirmation");
  };

  const returnHome = () => {
    setCheckoutContext(null);
    setCheckoutResult(null);
    setScreen("home");
  };

  const screens = [
    {
      key: "home",
      level: 0,
      node: <HomeScreen onOpenVoltz={() => setScreen("voltz")} voltzBalance={voltzBalance} />,
    },
    {
      key: "voltz",
      level: 1,
      node: (
        <VoltzScreen
          onBack={() => setScreen("home")}
          onGetMore={() => setScreen("get-more")}
          onPlans={() => setScreen("plans")}
          onSettings={() => setScreen("settings")}
          onEmail={() => setScreen("email")}
          onUsage={() => setScreen("usage")}
          voltzBalance={voltzBalance}
          activePlan={activePlan}
        />
      ),
    },
    {
      key: "get-more",
      level: 2,
      node: (
        <GetMoreScreen
          onBack={() => setScreen("voltz")}
          onBuyPack={(pack) => goToCheckout("voltz", pack)}
          onUpgradePlan={(plan) => goToCheckout("plan", plan)}
          activePlan={activePlan}
        />
      ),
    },
    {
      key: "plans",
      level: 2,
      node: (
        <PlansScreen
          onBack={() => setScreen("voltz")}
          onUpgradePlan={(plan) => goToCheckout("plan", plan)}
          voltzBalance={voltzBalance}
          activePlan={activePlan}
        />
      ),
    },
    {
      key: "settings",
      level: 2,
      node: (
        <SettingsScreen
          onBack={() => setScreen("voltz")}
          onSignOut={() => setScreen("home")}
          onChangePassword={() => setScreen("change-password")}
        />
      ),
    },
    {
      key: "email",
      level: 2,
      node: <EmailScreen onBack={() => setScreen("voltz")} />,
    },
    {
      key: "usage",
      level: 2,
      node: (
        <UsageScreen
          onBack={() => setScreen("voltz")}
          onTopUp={() => setScreen("get-more")}
        />
      ),
    },
    {
      key: "change-password",
      level: 3,
      node: <ChangePasswordScreen onBack={() => setScreen("settings")} />,
    },
    {
      key: "checkout",
      level: 3,
      node: (
        <CheckoutScreen
          onBack={() => setScreen(checkoutFrom)}
          context={checkoutContext}
          onComplete={completePurchase}
          voltzBalance={voltzBalance}
        />
      ),
    },
    {
      key: "confirmation",
      level: 4,
      node: (
        <ConfirmationScreen
          result={checkoutResult}
          voltzBalance={voltzBalance}
          onHome={returnHome}
        />
      ),
    },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 20%, #EAE4D5 0%, #D6CEBC 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 40, fontFamily: SANS,
    }}>
      <div style={{
        width: 390, height: 844, borderRadius: 44,
        overflow: "hidden", background: C.bg,
        border: "1px solid rgba(0,0,0,0.12)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.10)",
        position: "relative",
      }}>
        {screens.map(s => {
          let tx = "0";
          if (s.key !== screen) {
            if (s.level < currentLevel) tx = "-30%";
            else if (s.level > currentLevel) tx = "100%";
            else tx = "100%"; // sibling
          }
          return (
            <div key={s.key} style={{
              position: "absolute", inset: 0,
              transform: `translateX(${tx})`,
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              willChange: "transform", background: C.bg,
            }}>
              {s.node}
            </div>
          );
        })}
      </div>
    </div>
  );
}
