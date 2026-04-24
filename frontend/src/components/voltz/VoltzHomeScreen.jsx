import React from "react";
import { C, SERIF, SANS } from "./shared/designTokens";
import { BoltIcon, IconGear, IconHelp, IconChevronRight, IconExternal } from "./shared/icons";
import TopNav from "./shared/TopNav";

const PlanBadge = ({ kind }) => {
  const map = {
    Free:     { bg: C.pill,        text: C.secondary    },
    Luminary: { bg: C.luminaryBg,  text: C.luminaryText },
    Zenith:   { bg: C.zenithBg,    text: C.zenithText   },
  };
  const s = map[kind] || map.Free;
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

export default function VoltzHomeScreen({
  profile,
  voltzBalance,
  activePlan,
  onGetMore,
  onPlans,
  onSettings,
  onUsage,
  onBack,
}) {
  const planKindMap = { luminary: "Luminary", zenith: "Zenith" };
  const planKind = activePlan ? planKindMap[activePlan] : "Free";

  const displayName = profile?.username
    || profile?.first_name
    || profile?.full_name
    || "You";

  const initials = (profile?.first_name?.[0] || profile?.full_name?.[0] || "?").toUpperCase();

  const menu = [
    { key: "usage",    label: "Usage",    icon: <BoltIcon size={20} color={C.amber} />, trailing: "chevron", onClick: onUsage    },
    { key: "settings", label: "Settings", icon: <IconGear />,                           trailing: "chevron", onClick: onSettings },
    { key: "help",     label: "Get help", icon: <IconHelp />,                           trailing: "external", onClick: () => {} },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <TopNav title="Voltz" onBack={onBack} />

      {/* User + plan card */}
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
              {initials}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{
                fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {displayName}
              </div>
              <div><PlanBadge kind={planKind} /></div>
            </div>
            <button onClick={onPlans} style={{
              background: "transparent", border: `1.5px solid ${C.borderStrong}`,
              color: C.text, borderRadius: 999, padding: "8px 18px",
              fontSize: 13, fontWeight: 500, fontFamily: SANS, cursor: "pointer",
              flexShrink: 0,
            }}>
              {activePlan ? "Manage" : "Upgrade"}
            </button>
          </div>

          <div style={{ height: 1, background: C.border, margin: "14px 0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BoltIcon size={22} />
              <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: C.text, lineHeight: 1 }}>
                {voltzBalance}
              </span>
            </div>
            <button onClick={onGetMore} style={{
              background: "transparent", border: "none", padding: 4,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: SANS, fontSize: 14, color: C.text,
            }}>
              Get more
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div style={{ margin: "16px 20px 0 20px" }}>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, overflow: "hidden",
        }}>
          {menu.map((item, idx) => (
            <div
              key={item.key}
              onClick={item.onClick}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "15px 16px", cursor: "pointer",
                borderBottom: idx === menu.length - 1 ? "none" : `1px solid ${C.border}`,
              }}
            >
              <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.icon}
              </div>
              <span style={{ fontFamily: SANS, fontSize: 15, color: item.key === "help" ? C.helpRed : C.text }}>
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
}
