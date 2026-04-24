import React, { useState, useEffect } from "react";
import { C, SERIF, SANS } from "./shared/designTokens";
import { BoltIcon, IconChevronRight, IconScan, IconProfile } from "./shared/icons";
import TopNav from "./shared/TopNav";
import { tables, DB_ID, VOLTZ_LEDGER_TABLE, Query } from "../../lib/appwrite";
import { track, captureError } from "../../lib/tracking";

const SPENT_TYPES = ["ai_draft", "scan", "search", "profile_boost"];

const ACTION_CONFIG = {
  ai_draft:      { label: "AI message drafts",    icon: "bolt",    color: "#F59E0B" },
  scan:          { label: "Compatibility scans",  icon: "scan",    color: "#4CAF50" },
  search:        { label: "External searches",    icon: "search",  color: "#5B21B6" },
  profile_boost: { label: "Profile boosts",       icon: "profile", color: "#9E9B95" },
};

function ActionIcon({ kind }) {
  if (kind === "bolt") return <BoltIcon size={20} color="#F59E0B" />;
  if (kind === "scan") return <IconScan />;
  if (kind === "search") {
    return (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <line x1="20" y1="20" x2="15.5" y2="15.5" />
      </svg>
    );
  }
  if (kind === "profile") return <IconProfile />;
  return null;
}

export default function UsageScreen({ profile, onBack, onTopUp }) {
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const remaining = profile?.current_voltz ?? 0;

  useEffect(() => {
    if (!profile?.$id) return;
    track.voltzScreenView('usage');
    loadUsage();
  }, [profile?.$id]);

  async function loadUsage() {
    setLoading(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const result = await tables.listRows({
        databaseId: DB_ID,
        tableId: VOLTZ_LEDGER_TABLE,
        queries: [
          Query.equal("profile_row_id", [profile.$id]),
          Query.greaterThanEqual("awarded_at", startOfMonth.toISOString()),
          Query.orderDesc("awarded_at"),
          Query.limit(200),
        ],
      });

      // Group spent entries by event_type
      const grouped = {};
      let spentTotal = 0;

      for (const row of result.rows || []) {
        const isSpent = SPENT_TYPES.includes(row.event_type) || (row.amount && row.amount < 0);
        if (!isSpent) continue;

        const type = row.event_type;
        const abs = Math.abs(row.amount || 0);
        spentTotal += abs;

        if (!grouped[type]) {
          grouped[type] = { event_type: type, voltz: 0, count: 0 };
        }
        grouped[type].voltz += abs;
        grouped[type].count += 1;
      }

      // Map to display rows
      const rows = Object.values(grouped).map(g => {
        const cfg = ACTION_CONFIG[g.event_type] || {
          label: g.event_type.replace(/_/g, " "),
          icon: "bolt",
          color: C.amber,
        };
        return { ...g, ...cfg };
      });

      rows.sort((a, b) => b.voltz - a.voltz);
      setBreakdown(rows);
      setTotalSpent(spentTotal);
    } catch (err) {
      console.error("Usage fetch error:", err);
      captureError(err, { context: 'voltz_usage_load' });
    } finally {
      setLoading(false);
    }
  }

  const total = remaining + totalSpent;
  const progressPct = total > 0 ? Math.round((remaining / total) * 100) : 100;
  const runningLow = remaining > 0 && remaining < 20;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <TopNav title="Usage" onBack={onBack} />

      {/* Summary card */}
      <div style={{ margin: "8px 20px 0 20px" }}>
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: SANS, fontSize: 13, color: C.secondary }}>This month</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <BoltIcon size={13} />
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text }}>
                {remaining} voltz left
              </span>
            </div>
          </div>

          <div style={{
            width: "100%", height: 6, borderRadius: 999,
            background: "rgba(0,0,0,0.08)", marginTop: 16, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 999,
              background: runningLow ? C.amber : C.accentGreen,
              width: `${progressPct}%`,
              transition: "width 0.6s ease",
            }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>0</span>
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>{total} voltz</span>
          </div>

          <div style={{ height: 1, background: C.border, margin: "16px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: C.text }}>
              {loading ? "—" : `${totalSpent} voltz spent`}
            </div>
            <button style={{
              background: "transparent", border: "none", padding: 0,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: SANS, fontSize: 12, color: C.secondary,
            }}>
              View history
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={C.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ margin: "24px 20px 0 20px" }}>
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: C.secondary, marginBottom: 12,
        }}>
          Spent by action
        </div>

        {loading ? (
          <div style={{
            display: "flex", justifyContent: "center", padding: "40px 0",
            fontFamily: SANS, fontSize: 14, color: C.secondary,
          }}>
            Loading…
          </div>
        ) : breakdown.length === 0 ? (
          <div style={{
            background: C.card, borderRadius: 16,
            border: `1px solid ${C.border}`, padding: 32,
            textAlign: "center",
          }}>
            <div style={{ fontFamily: SANS, fontSize: 14, color: C.secondary }}>
              No voltz spent yet this month.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {breakdown.map(item => {
              const pct = totalSpent > 0 ? Math.round((item.voltz / totalSpent) * 100) : 0;
              return (
                <div key={item.event_type} style={{
                  background: C.card, borderRadius: 16,
                  border: `1px solid ${C.border}`, padding: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ActionIcon kind={item.icon} />
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.text }}>
                      {item.label}
                    </span>
                    <span style={{ marginLeft: "auto", fontFamily: SANS, fontSize: 12, color: C.secondary }}>
                      {item.count} use{item.count !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div style={{
                    width: "100%", height: 5, borderRadius: 999,
                    background: "rgba(0,0,0,0.08)", marginTop: 10, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      background: item.color,
                      width: `${pct}%`,
                      transition: "width 0.6s ease",
                    }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
                    <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text }}>
                      {item.voltz} voltz
                    </span>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top-up nudge */}
      <div
        onClick={onTopUp}
        style={{
          margin: "20px 20px 40px 20px",
          background: C.cardWarm, borderRadius: 16, padding: 16,
          display: "flex", alignItems: "center", cursor: "pointer",
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "#FFF8E7",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <BoltIcon size={18} />
        </div>
        <div style={{ marginLeft: 12, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text }}>
            {runningLow ? "Running low!" : "Need more voltz?"}
          </span>
          <span style={{ fontFamily: SANS, fontSize: 12, color: C.secondary }}>Top up your balance</span>
        </div>
        <div style={{ marginLeft: "auto", display: "inline-flex" }}>
          <IconChevronRight />
        </div>
      </div>
    </div>
  );
}
