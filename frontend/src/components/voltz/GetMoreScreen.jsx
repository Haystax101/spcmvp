import React from "react";
import { C, SANS, PLANS } from "./shared/designTokens";
import TopNav from "./shared/TopNav";
import PlanCard from "./shared/PlanCard";
import InviteCard from "./shared/InviteCard";

export default function GetMoreScreen({ profile, activePlan, onBack, onSelectPlan }) {

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <TopNav title="Get voltz" onBack={onBack} />

      {/* Invite card */}
      <div style={{ margin: "0 20px" }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: C.secondary, marginBottom: 12,
        }}>
          Invite friends
        </div>
        <InviteCard referralCode={profile?.referral_code} />
      </div>

      {/* Plan upgrades */}
      <div style={{ margin: "24px 20px 0 20px", paddingBottom: 40 }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: C.secondary, marginBottom: 12,
        }}>
          Upgrade your plan
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PlanCard plan={PLANS.spark}  activePlan={activePlan} onAction={onSelectPlan} />
          <PlanCard plan={PLANS.zenith} activePlan={activePlan} onAction={onSelectPlan} />
        </div>
      </div>
    </div>
  );
}
