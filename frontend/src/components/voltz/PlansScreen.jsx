import React from "react";
import { C, SERIF, SANS, PLANS } from "./shared/designTokens";
import { BoltIcon } from "./shared/icons";
import TopNav from "./shared/TopNav";
import PlanCard from "./shared/PlanCard";
import InviteCard from "./shared/InviteCard";

const PlanBadge = ({ kind }) => {
  const map = {
    Free:   { bg: C.pill,        text: C.secondary    },
    Spark:  { bg: C.luminaryBg,  text: C.luminaryText },
    Zenith: { bg: C.zenithBg,    text: C.zenithText   },
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

export default function PlansScreen({ profile, activePlan, voltzBalance, onBack, onSelectPlan }) {
  const planKindMap = { spark: "Spark", zenith: "Zenith" };
  const planKind = activePlan ? planKindMap[activePlan] : "Free";
  const planLabel = activePlan
    ? `You're on ${planKindMap[activePlan]}`
    : "You're on the Free plan";

  const displayName = profile?.username || profile?.first_name || profile?.full_name || "You";
  const initials = (profile?.first_name?.[0] || profile?.full_name?.[0] || "?").toUpperCase();

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <TopNav title="Plans" onBack={onBack} />

      {/* Invite card */}
      <div style={{ margin: "0 20px" }}>
        <InviteCard referralCode={profile?.referral_code} />
      </div>

      {/* User card */}
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
              {initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text }}>
                {displayName}
              </div>
              <PlanBadge kind={planKind} />
            </div>
          </div>

          <div style={{ height: 1, background: C.border, margin: "14px 0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.text }}>{planLabel}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BoltIcon size={16} />
              <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.text }}>
                {voltzBalance}
              </span>
            </div>
          </div>

          {!activePlan && (
            <>
              <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
              <div style={{ fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                Upgrade to get monthly voltz, unlimited AI searches, and priority matching.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ margin: "24px 20px 0 20px", paddingBottom: 40 }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: C.secondary, marginBottom: 12,
        }}>
          {activePlan ? "Plans" : "Choose a plan"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PlanCard plan={PLANS.spark}  activePlan={activePlan} onAction={onSelectPlan} />
          <PlanCard plan={PLANS.zenith} activePlan={activePlan} onAction={onSelectPlan} />
        </div>
      </div>
    </div>
  );
}
