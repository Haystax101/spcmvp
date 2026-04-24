import React, { useState } from "react";
import { C, SERIF, SANS, getBonusVoltz } from "./shared/designTokens";
import { BoltIcon, IconLock, IconCheck } from "./shared/icons";
import TopNav from "./shared/TopNav";
import { functions } from "../../lib/appwrite";
import { track, captureError } from "../../lib/tracking";

const STRIPE_GATEWAY_ID = "stripeGateway";

function PriceBlock({ price, original, suffix, alignRight = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: alignRight ? "flex-end" : "flex-start", lineHeight: 1 }}>
      {original && (
        <span style={{ fontFamily: SANS, fontSize: 11, color: C.muted, textDecoration: "line-through", marginBottom: 4 }}>
          ${original.toFixed(2)}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.text }}>${price.toFixed(2)}</span>
        {suffix && <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>{suffix}</span>}
      </div>
    </div>
  );
}

function StepperButton({ children, onClick, filled, disabled }) {
  return (
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
      }}
    >
      {children}
    </button>
  );
}

export default function CheckoutScreen({ context, userId, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const item = context?.item;
  if (!item) return null;

  const totalPrice = item.price;
  const baseVoltz = item.voltzPerMonth;
  const bonusVoltz = 0;

  const handleCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await functions.createExecution(
        STRIPE_GATEWAY_ID,
        JSON.stringify({
          action: "create_checkout_session",
          userId,
          package: item.id,
          quantity: 1,
          successUrl: window.location.origin + "?payment=success",
          cancelUrl: window.location.origin + "?payment=cancelled",
        }),
        false
      );

      if (!response?.responseBody) throw new Error("Payment server didn't respond.");

      let data;
      try {
        data = JSON.parse(response.responseBody);
      } catch {
        throw new Error("Invalid response from payment server.");
      }

      if (data.url) {
        if (data.session_id) localStorage.setItem("sc_pending_stripe_session", data.session_id);
        track.userAction('stripe_checkout_session_created', { packageId: item.id, sessionId: data.session_id });
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session.");
      }
    } catch (err) {
      const message = err.message || "Something went wrong. Please try again.";
      setError(message);
      captureError(err, { context: 'checkout_session_creation', packageId: item.id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <TopNav
        title="Secure checkout"
        onBack={onBack}
        titleLeading={<IconLock size={12} color={C.secondary} />}
      />

      {/* Order summary */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: C.secondary, marginBottom: 12,
        }}>
          Your order
        </div>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 20, color: C.text }}>{item.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <BoltIcon size={14} />
                <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>
                  {isVoltz ? item.voltzLabel : item.voltzLabel}
                </span>
              </div>
            </div>
            <PriceBlock
              price={item.price}
              suffix="/month"
              alignRight
            />
          </div>

          {/* Plan feature preview */}
          {item.features && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {item.features.slice(0, 2).map(f => (
                <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <IconCheck />
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: C.border, margin: "16px 0" }} />

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontFamily: SANS, fontSize: 14, color: C.secondary }}>Total</span>
            <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.text }}>
              ${totalPrice.toFixed(2)}
              {!isVoltz && <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary, fontWeight: 400 }}>/mo</span>}
            </span>
          </div>

        </div>
      </div>

      {/* Payment brand decoration */}
      <div style={{ margin: "16px 20px 0 20px" }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: C.secondary, marginBottom: 12,
        }}>
          Payment
        </div>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.secondary, marginBottom: 14 }}>
            You'll be redirected to our secure payment page.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["VISA", "MC", "AMEX"].map(brand => (
              <span key={brand} style={{
                background: "#F5F5F5", border: `1px solid ${C.border}`,
                borderRadius: 6, padding: "4px 10px",
                fontSize: 11, fontWeight: 600, color: C.secondary,
                fontFamily: SANS, letterSpacing: "0.04em",
              }}>
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: "12px 20px 0 20px", padding: "12px 16px",
          background: C.redBg, borderRadius: 10,
          fontFamily: SANS, fontSize: 13, color: C.redText,
        }}>
          {error}
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          display: "block", margin: "20px 20px 0 20px",
          width: "calc(100% - 40px)", boxSizing: "border-box",
          background: loading ? C.secondary : C.borderStrong,
          color: "#FFFFFF", border: "none", borderRadius: 999,
          fontSize: 16, fontWeight: 500, fontFamily: SANS,
          padding: "16px 24px", cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? (
          "Connecting to payment…"
        ) : (
          `Start plan — $${totalPrice.toFixed(2)}/mo`
        )}
      </button>

      <div style={{
        margin: "12px 20px 40px 20px", textAlign: "center",
        fontFamily: SANS, fontSize: 12, color: C.secondary,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      }}>
        <IconLock size={12} color={C.secondary} />
        <span>Your payment is encrypted and secure.</span>
      </div>
    </div>
  );
}
