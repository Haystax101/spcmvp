import React, { useEffect } from "react";
import { C, SERIF, SANS, CONFETTI_PIECES } from "./shared/designTokens";
import { BoltIcon } from "./shared/icons";
import { track } from "../../lib/tracking";

function Confetti() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {CONFETTI_PIECES.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute", top: 0, left: `${p.x}%`,
            width: p.width, height: p.height,
            background: p.color, borderRadius: 1,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFall ${p.duration}s ${p.delay}s cubic-bezier(0.4, 0, 0.6, 1) forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

export default function ConfirmationScreen({ result, voltzBalance, onHome }) {
  useEffect(() => {
    if (result) {
      track.voltzPurchaseCompleted(result.packageName, result.voltzAdded, result.item?.price);
    }
  }, [result]);

  if (!result) return null;

  const isVoltz = result.type === "voltz";
  const bonusV = result.bonusVoltz || 0;
  const mainVoltz = isVoltz ? result.baseVoltz : (result.item?.voltzPerMonth || result.voltzAdded || 0);
  const newBalance = voltzBalance;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, position: "relative" }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(500px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <Confetti />

      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        minHeight: "80%", padding: "40px 24px",
        position: "relative", zIndex: 2,
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

        <h1 style={{
          fontFamily: SERIF, fontSize: 28, color: C.text,
          textAlign: "center", lineHeight: 1.2,
          margin: "24px 0 0 0", fontWeight: 400,
        }}>
          {isVoltz ? "Your voltz just landed." : `Welcome to ${result.item?.name || "your plan"}.`}
        </h1>

        <p style={{
          fontFamily: SANS, fontSize: 15, color: C.secondary,
          textAlign: "center", lineHeight: 1.6,
          maxWidth: 280, margin: "10px 0 0 0",
        }}>
          {isVoltz
            ? `${mainVoltz} voltz added to your balance. Plus ${bonusV} bonus voltz — on us.`
            : `${mainVoltz.toLocaleString()} voltz added. Refreshes monthly. Plus ${bonusV} bonus voltz, one time on us.`
          }
        </p>

        {/* Voltz breakdown card */}
        <div style={{
          marginTop: 28, width: "100%",
          background: C.card, borderRadius: 16,
          border: `1.5px solid ${C.borderStrong}`, padding: 20,
          animation: "popIn 0.5s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          opacity: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            paddingBottom: 14, borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "#FFF8E7",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
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
              <div style={{ fontFamily: SERIF, fontSize: 32, color: C.text, lineHeight: 1, letterSpacing: "-0.01em" }}>
                +{mainVoltz.toLocaleString()} voltz
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.secondary, marginTop: 3 }}>
                {isVoltz ? "Added to your balance" : "Refreshes every month"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14 }}>
            <div>
              <div style={{
                fontFamily: SANS, fontSize: 11, fontWeight: 600,
                color: C.greenText, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 3,
              }}>
                Free bonus — on us
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 22, color: C.text, lineHeight: 1.1 }}>
                +{bonusV} voltz
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.secondary, marginTop: 2 }}>
                as a gift from us!
              </div>
            </div>
            <div style={{ background: C.greenBg, borderRadius: 999, padding: "6px 14px" }}>
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.greenText }}>Free</span>
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

        <button
          onClick={onHome}
          style={{
            width: "100%", marginTop: 32, boxSizing: "border-box",
            background: C.borderStrong, color: "#FFFFFF",
            border: "none", borderRadius: 999, padding: "13px 24px",
            fontSize: 14, fontWeight: 500, fontFamily: SANS, cursor: "pointer",
          }}
        >
          Back to home
        </button>

        {!isVoltz && (
          <div style={{ marginTop: 12, fontFamily: SANS, fontSize: 12, color: C.secondary, textAlign: "center" }}>
            Manage your plan anytime from the Voltz page.
          </div>
        )}
      </div>
    </div>
  );
}
