import React from "react";
import { C } from "./designTokens";

export default function Toggle({ on, onToggle }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: on ? C.accentGreen : "#D1CFC9",
        border: "none", cursor: "pointer", padding: 3,
        display: "flex", alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
        transition: "background 0.2s ease",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        transition: "transform 0.2s ease",
      }} />
    </button>
  );
}
