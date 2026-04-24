import React, { useState } from "react";
import { C, SANS } from "./shared/designTokens";
import { IconGear, IconLock, IconShield, IconGlobe, IconSignOut, IconChevronRight } from "./shared/icons";
import TopNav from "./shared/TopNav";
import Toggle from "./shared/Toggle";

const IconShieldLock = ({ size = 20, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z" />
    <rect x="9.5" y="11" width="5" height="4" rx="0.6" />
    <path d="M10.5 11 V9.5 a1.5 1.5 0 0 1 3 0 V11" />
  </svg>
);

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: SANS, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.10em", textTransform: "uppercase",
      color: C.secondary, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function MenuRow({ icon, label, trailing, onClick, danger, noChevron, rightSlot }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "15px 16px", cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{
        fontFamily: SANS, fontSize: 15,
        fontWeight: danger ? 500 : 400,
        color: danger ? C.helpRed : C.text,
        flex: 1,
      }}>
        {label}
      </span>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {trailing && <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>{trailing}</span>}
        {rightSlot}
        {!noChevron && !rightSlot && <IconChevronRight />}
      </div>
    </div>
  );
}

export default function SettingsScreen({ profile, onBack, onChangePassword, onSignOut, onSaveNotifPrefs }) {
  const [newConnections, setNewConnections] = useState(profile?.notify_new_connections ?? true);
  const [messageReplies, setMessageReplies] = useState(profile?.notify_message_replies ?? true);
  const [weeklyDigest,   setWeeklyDigest]   = useState(profile?.notify_weekly_digest   ?? false);

  const savePrefs = (prefs) => {
    if (onSaveNotifPrefs) onSaveNotifPrefs(prefs);
  };

  const toggleNewConnections = () => {
    const next = !newConnections;
    setNewConnections(next);
    savePrefs({ notify_new_connections: next, notify_message_replies: messageReplies, notify_weekly_digest: weeklyDigest });
  };

  const toggleMessageReplies = () => {
    const next = !messageReplies;
    setMessageReplies(next);
    savePrefs({ notify_new_connections: newConnections, notify_message_replies: next, notify_weekly_digest: weeklyDigest });
  };

  const toggleWeeklyDigest = () => {
    const next = !weeklyDigest;
    setWeeklyDigest(next);
    savePrefs({ notify_new_connections: newConnections, notify_message_replies: messageReplies, notify_weekly_digest: next });
  };

  const notifications = [
    { label: "New connections",  state: newConnections, onToggle: toggleNewConnections },
    { label: "Message replies",  state: messageReplies, onToggle: toggleMessageReplies },
    { label: "Weekly digest",    state: weeklyDigest,   onToggle: toggleWeeklyDigest   },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <TopNav title="Settings" onBack={onBack} />

      {/* Notifications */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <SectionLabel>Notifications</SectionLabel>
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {notifications.map((n, idx) => (
            <div
              key={n.label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "15px 16px",
                borderBottom: idx === notifications.length - 1 ? "none" : `1px solid ${C.border}`,
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: 15, color: C.text }}>{n.label}</span>
              <Toggle on={n.state} onToggle={n.onToggle} />
            </div>
          ))}
        </div>
      </div>

      {/* Privacy — read-only disclosures */}
      <div style={{ margin: "16px 20px 0 20px" }}>
        <SectionLabel>Privacy</SectionLabel>
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {/* AI data deletion */}
          <div style={{ padding: "16px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <IconShield size={20} color={C.accentGreen} />
              </div>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  AI data deletion
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.secondary, lineHeight: 1.5 }}>
                  Data sent to our AI is deleted immediately after processing and is never retained or used for training.
                </div>
              </div>
            </div>
          </div>

          {/* Profile discoverability */}
          <div style={{ padding: "16px 16px" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <IconGlobe size={20} color={C.text} />
              </div>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  Profile discoverability
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.secondary, lineHeight: 1.5 }}>
                  Connections surfaced on Supercharged are discoverable through the open web. Your profile information may appear in public search results.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div style={{ margin: "16px 20px 40px 20px" }}>
        <SectionLabel>Account</SectionLabel>
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
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
}
