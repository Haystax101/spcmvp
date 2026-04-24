import React, { useState } from "react";
import { Zap, Eye, Flame, Check } from "lucide-react";

const C = {
  bg: "#EFEFEF",
  card: "#FFFFFF",
  text: "#111111",
  secondary: "#A8A8A8",
  muted: "#AAAAAA",
  border: "#EFEFEF",
  accent: "#22C55E",
  accentGold: "#F5A623",
  hover: "#FAFAFA",
};

const b = (text) => <strong style={{ fontWeight: 700 }}>{text}</strong>;

function Avatar({ notification }) {
  const size = 48;
  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: notification.avatarBg,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0.2,
    position: "relative",
  };

  let inner;
  if (notification.type === "icon") {
    if (notification.icon === "zap")
      inner = <Zap size={22} color="white" fill="white" strokeWidth={0} />;
    if (notification.icon === "flame")
      inner = <Flame size={22} color="white" fill="white" strokeWidth={0} />;
    if (notification.icon === "eye")
      inner = <Eye size={22} color="white" strokeWidth={2.2} />;
  } else {
    inner = <span>{notification.initials}</span>;
  }

  return (
    <div style={base}>
      {inner}
      {notification.badge === "new" && (
        <span
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: C.accent,
            border: `2px solid ${C.card}`,
          }}
        />
      )}
    </div>
  );
}

function NotificationRow({ notification, isRead, onRowPress, onDraftPress }) {
  const textColor = isRead ? C.muted : C.text;
  const timeColor = isRead ? C.border : C.secondary;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onRowPress(notification)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowPress(notification);
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        padding: "18px 20px 18px 12px",
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "background 120ms ease",
        outline: "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Unread dot */}
      <div
        style={{
          width: 10,
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          paddingTop: 20,
        }}
      >
        {!isRead && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.text,
              display: "block",
            }}
          />
        )}
      </div>

      <Avatar notification={notification} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <p
            style={{
              flex: 1,
              margin: 0,
              fontSize: 15,
              lineHeight: 1.45,
              color: textColor,
              fontWeight: 400,
              transition: "color 200ms ease",
            }}
          >
            {notification.body}
          </p>
          <span
            style={{
              fontSize: 12,
              color: timeColor,
              flexShrink: 0,
              marginTop: 2,
              transition: "color 200ms ease",
            }}
          >
            {notification.time}
          </span>
        </div>
        {notification.draft && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDraftPress(notification);
            }}
            style={{
              marginTop: 12,
              background: C.card,
              border: `1.5px solid ${C.text}`,
              color: C.text,
              fontSize: 14,
              fontWeight: 700,
              height: 44,
              padding: "0 18px",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: 0.1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {notification.aiDraft && (
              <Zap
                size={16}
                color={C.accentGold}
                fill={C.accentGold}
                strokeWidth={0}
                aria-hidden="true"
              />
            )}
            <span>Draft with AI ›</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPanel({
  notifications = [],
  onNotificationPress = () => {},
  onDraftPress = () => {},
  onMarkAllRead = () => {},
  onBack = () => {},
}) {
  const [allRead, setAllRead] = useState(false);

  const handleMarkAllRead = () => {
    setAllRead(true);
    onMarkAllRead();
  };

  const handleRowPress = (notification) => {
    onNotificationPress(notification);
  };

  const handleDraftPress = (notification) => {
    onDraftPress(notification);
  };

  if (notifications.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100vh",
          background: C.card,
          display: "flex",
          flexDirection: "column",
          fontFamily: '-apple-system, "SF Pro Text", sans-serif',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "20px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <button onClick={onBack} style={{ background: "none", border: "none", padding: "0 8px 0 0", fontSize: 24, cursor: "pointer", color: C.text }}>‹</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>Notifications</h2>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <p style={{ color: C.secondary, fontSize: 15 }}>No notifications yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: C.card,
        display: "flex",
        flexDirection: "column",
        fontFamily: '-apple-system, "SF Pro Text", sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 20px 18px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button 
            onClick={onBack} 
            style={{ 
              background: "none", 
              border: "none", 
              padding: 0, 
              fontSize: 28, 
              lineHeight: 1,
              cursor: "pointer", 
              color: C.text,
              marginTop: -2
            }}
          >
            ‹
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: C.text,
              letterSpacing: -0.2,
            }}
          >
            Notifications
          </h2>
        </div>
        <button
          onClick={handleMarkAllRead}
          aria-label={allRead ? "All read" : "Mark all read"}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 14,
            color: C.text,
            cursor: allRead ? "default" : "pointer",
            fontFamily: "inherit",
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: 20,
            minWidth: 92,
            opacity: allRead ? 0.5 : 1,
          }}
          disabled={allRead}
        >
          <span
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: `translateY(-50%) scale(${allRead ? 0.96 : 1})`,
              opacity: allRead ? 0 : 1,
              transition:
                "opacity 180ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            Mark all read
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: C.accent,
              opacity: allRead ? 1 : 0,
              transform: `scale(${allRead ? 1 : 0.6})`,
              transition:
                "opacity 220ms ease 120ms, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms",
              pointerEvents: "none",
            }}
          >
            <Check size={14} color="white" strokeWidth={3} />
          </span>
        </button>
      </div>

      {/* Notifications list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 100, // Padding for bottom navbar
        }}
      >
        {notifications.map((n, i) => (
          <div
            key={n.id || i}
            style={{
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <NotificationRow
              notification={n}
              isRead={allRead || n.read}
              onRowPress={handleRowPress}
              onDraftPress={handleDraftPress}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
