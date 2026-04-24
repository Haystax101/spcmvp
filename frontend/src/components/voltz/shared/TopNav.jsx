import React from "react";
import { C, SERIF } from "./designTokens";
import { IconChevronLeft } from "./icons";

export default function TopNav({ title, onBack, titleLeading, rightSlot }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      padding: "16px 20px",
      flexShrink: 0,
    }}>
      <div>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            style={{
              background: "transparent", border: "none", padding: 4,
              cursor: "pointer", display: "inline-flex",
            }}
          >
            <IconChevronLeft />
          </button>
        )}
      </div>
      <div style={{
        fontFamily: SERIF, fontSize: 20, color: C.text, textAlign: "center",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        {titleLeading}
        <span>{title}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {rightSlot}
      </div>
    </div>
  );
}
