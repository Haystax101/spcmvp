import React from "react";
import { C, SERIF, SANS } from "./designTokens";
import { BoltIcon, IconCheck } from "./icons";

function PriceBlock({ price, original, suffix, big = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
      {original && (
        <span style={{ fontFamily: SANS, fontSize: 11, color: C.muted, textDecoration: "line-through", marginBottom: 4 }}>
          ${original.toFixed(2)}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: SERIF, fontSize: big ? 36 : 20, fontWeight: 600, color: C.text, letterSpacing: big ? "-0.01em" : "0" }}>
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
}

export default function PlanCard({ plan, activePlan, onAction }) {
  const isZenith = plan.id === "zenith";
  const isCurrent = activePlan === plan.id;
  const isDowngrade = activePlan === "zenith" && plan.id === "spark";

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
      {isZenith ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
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
        <div style={{ fontFamily: SERIF, fontSize: 22, color: C.text, marginBottom: 8 }}>{plan.name}</div>
      )}

      <PriceBlock price={plan.price} suffix="/month" big />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <BoltIcon size={14} />
        <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>{plan.voltzLabel}</span>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 11, color: C.muted, marginTop: 4 }}>{plan.context}</div>

      <div style={{ height: 1, background: C.border, marginTop: 14, marginBottom: 14 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <IconCheck />
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>

      {isCurrent ? (
        <div style={{
          width: "100%", marginTop: 20, padding: "13px 24px",
          borderRadius: 999, background: "transparent",
          border: `1.5px solid ${C.border}`, color: C.secondary,
          fontSize: 14, fontWeight: 500, fontFamily: SANS,
          textAlign: "center", cursor: "default", boxSizing: "border-box",
        }}>
          Current plan
        </div>
      ) : (
        <button
          onClick={() => onAction && onAction(plan)}
          style={{
            width: "100%", marginTop: 20, padding: "13px 24px",
            background: C.borderStrong, color: "#FFFFFF",
            border: "none", borderRadius: 999,
            fontSize: 14, fontWeight: 500, fontFamily: SANS,
            cursor: "pointer", boxSizing: "border-box",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
