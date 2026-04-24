import React, { useState } from "react";
import { C, SERIF, SANS, MONO } from "./designTokens";
import { track } from "../../../lib/tracking";

export default function InviteCard({ referralCode }) {
  const [copied, setCopied] = useState(false);

  const referralUrl = referralCode
    ? `https://getsupercharged.app/signup?ref=${referralCode}`
    : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      track.voltzReferralLinkCopied();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement("textarea");
      ta.value = referralUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      track.voltzReferralLinkCopied();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Supercharged",
          text: "Connect with exceptional people — join via my referral link.",
          url: referralUrl,
        });
        track.voltzReferralLinkShared();
      } catch {
        // User cancelled share — no-op
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div style={{
      background: C.borderStrong, borderRadius: 16, padding: 20, color: "#FFFFFF",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: "#FFFFFF", marginBottom: 6 }}>
            Invite Friends
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, maxWidth: 200 }}>
            Earn 100 voltz for every friend who joins using your link.
          </div>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.1)", borderRadius: 12,
          padding: "6px 12px",
          fontFamily: SANS, fontSize: 12, fontWeight: 600,
          color: "rgba(255,255,255,0.8)",
        }}>
          +100 each
        </div>
      </div>

      <div style={{
        marginTop: 16, background: "rgba(255,255,255,0.08)",
        borderRadius: 10, padding: "10px 14px",
        fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.7)",
        letterSpacing: "0.02em", wordBreak: "break-all",
        minHeight: "20px", display: "flex", alignItems: "center",
      }}>
        {referralUrl ? referralUrl : "Loading your referral link…"}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, padding: "11px 0",
            background: copied ? C.accentGreen : "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.2)",
            borderRadius: 999, color: "#FFFFFF",
            fontFamily: SANS, fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "background 0.2s",
          }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={handleShare}
          style={{
            flex: 1, padding: "11px 0",
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.2)",
            borderRadius: 999, color: "#FFFFFF",
            fontFamily: SANS, fontSize: 13, fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
}
