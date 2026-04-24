import React, { useState } from "react";
import { C, SERIF, SANS } from "./shared/designTokens";
import { IconEye, IconEyeOff } from "./shared/icons";
import TopNav from "./shared/TopNav";
import { account } from "../../lib/appwrite";
import { track, captureError } from "../../lib/tracking";

const getStrength = (pw) => {
  if (pw.length === 0) return null;
  if (pw.length < 6) return { label: "Too short", color: "#E53935", width: "20%" };
  if (pw.length < 8) return { label: "Weak",      color: "#F59E0B", width: "45%" };
  if (!/[0-9]/.test(pw) || !/[A-Z]/.test(pw))
    return { label: "Fair",   color: "#F59E0B", width: "65%" };
  return { label: "Strong",  color: "#4CAF50", width: "100%" };
};

export default function ChangePasswordScreen({ onBack }) {
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorCurrent, setErrorCurrent] = useState("");
  const [errorMatch,   setErrorMatch]   = useState("");
  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState(false);

  const strength = getStrength(newPw);

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

  const eyeBtn = {
    position: "absolute", right: 14, top: "50%",
    transform: "translateY(-50%)",
    background: "transparent", border: "none",
    padding: 0, cursor: "pointer", display: "inline-flex",
  };

  const handleSave = async () => {
    let ok = true;
    setErrorCurrent("");
    setErrorMatch("");

    if (!currentPw) {
      setErrorCurrent("Please enter your current password.");
      ok = false;
    }
    if (newPw !== confirmPw) {
      setErrorMatch("Passwords don't match.");
      ok = false;
    }
    if (newPw.length < 8) {
      setErrorMatch("Password must be at least 8 characters.");
      ok = false;
    }
    if (!ok) return;

    setLoading(true);
    try {
      await account.updatePassword(newPw, currentPw);
      track.voltzPasswordChanged();
      setSuccess(true);
    } catch (err) {
      if (err.code === 401 || /invalid/i.test(err.message)) {
        setErrorCurrent("Current password is incorrect.");
      } else {
        setErrorCurrent(err.message || "Something went wrong. Please try again.");
        captureError(err, { context: 'password_change_failed' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <style>{`@keyframes popIn { 0% { transform: scale(0.6); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }`}</style>
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
            <div style={{ fontFamily: SERIF, fontSize: 20, color: C.text }}>Password updated</div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.secondary, marginTop: 8, lineHeight: 1.5 }}>
              Your password has been changed successfully.
            </div>
            <button
              onClick={onBack}
              style={{
                marginTop: 20, padding: "11px 24px",
                background: "transparent", border: `1.5px solid ${C.borderStrong}`,
                color: C.text, borderRadius: 999,
                fontSize: 14, fontWeight: 500, fontFamily: SANS, cursor: "pointer",
              }}
            >
              Back to settings
            </button>
          </div>
        </div>
      ) : (
        <div style={{ margin: "8px 20px 40px 20px" }}>
          <div style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 600,
            letterSpacing: "0.10em", textTransform: "uppercase",
            color: C.secondary, marginBottom: 12,
          }}>
            Update password
          </div>
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>

            {/* Current password */}
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showCurrent ? "text" : "password"}
                placeholder="Current password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                style={inputStyle}
              />
              <button onClick={() => setShowCurrent(s => !s)} style={eyeBtn} aria-label="Toggle visibility">
                {showCurrent ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {errorCurrent && (
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.helpRed, marginTop: 6 }}>{errorCurrent}</div>
            )}

            {/* New password */}
            <div style={{ position: "relative", width: "100%", marginTop: 10 }}>
              <input
                type={showNew ? "text" : "password"}
                placeholder="New password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                style={inputStyle}
              />
              <button onClick={() => setShowNew(s => !s)} style={eyeBtn} aria-label="Toggle visibility">
                {showNew ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>

            {/* Strength meter */}
            {strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ width: "100%", height: 4, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: strength.color, width: strength.width, transition: "width 0.3s ease, background 0.3s ease" }} />
                </div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: strength.color, marginTop: 4 }}>{strength.label}</div>
              </div>
            )}

            {/* Confirm password */}
            <div style={{ position: "relative", width: "100%", marginTop: 10 }}>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                style={inputStyle}
              />
              <button onClick={() => setShowConfirm(s => !s)} style={eyeBtn} aria-label="Toggle visibility">
                {showConfirm ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {errorMatch && (
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.helpRed, marginTop: 6 }}>{errorMatch}</div>
            )}

            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                width: "100%", marginTop: 20,
                background: loading ? C.secondary : C.borderStrong,
                color: "#FFFFFF", border: "none", borderRadius: 999,
                padding: "13px 24px",
                fontSize: 14, fontWeight: 500, fontFamily: SANS,
                cursor: loading ? "default" : "pointer",
                boxSizing: "border-box",
              }}
            >
              {loading ? "Saving…" : "Save password"}
            </button>

            <div style={{ fontFamily: SANS, fontSize: 12, color: C.secondary, textAlign: "center", marginTop: 10 }}>
              Use 8+ characters with a number and uppercase letter.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
