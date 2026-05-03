import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Bell } from 'lucide-react';
import { track } from './lib/tracking';
import {
  functions,
  tables,
  DB_ID,
  PROFILES_TABLE,
  CONNECTION_GATEWAY_FUNCTION_ID,
  DISCOVERY_FUNCTION_ID,
  Query,
} from './lib/appwrite';
import { getProfilePhotoUrl, PHOTO_SIZES } from './lib/photos';

const DISCOVERY_QUEUE_TABLE = 'discovery_queue';
import { readCacheValue, writeCacheEntry } from './lib/cache';

import ComposeScreen from './components/ComposeScreen';
import ConnectionResult from './components/ConnectionResult';
import ProfileView from './components/ProfileView';
import NotificationsPanel from './components/NotificationsPanel';
import { CardPhoto, Chip, CardButton, NewConnectionCard, SurfacedCard, CardStack } from './components/HomeCards';
import { VoltzWallet } from './components/VoltzSystem';
// ─── Cache TTLs ───────────────────────────────────────────────────────────────
const SURFACED_TTL = 5 * 60 * 1000;

// ─── Execute an Appwrite function ─────────────────────────────────────────────
async function executeFunction(functionId, payload) {
  const exec = await functions.createExecution(functionId, JSON.stringify(payload), false);
  return JSON.parse(exec.responseBody);
}

// Photo URL building uses the centralized photo utility

// ─── Colour helpers ───────────────────────────────────────────────────────────
const compatColor = (score) => {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--dim-network)';
  return 'var(--text2)';
};

// Map compat snapshot breakdown keys → display dimensions
const DIM_DISPLAY = [
  { key: 'background', label: 'Network', sub: 'College & shared circles', color: 'var(--success)' },
  { key: 'goals', label: 'Goals', sub: 'Aligned intent & goals', color: 'var(--dim-network)' },
  { key: 'network', label: 'Stage', sub: 'Career & project timing', color: '#F59E0B' },
  { key: 'stage', label: 'Sync', sub: 'AI-powered resonance', color: '#8B6DD3' },
];

// Compute 4 dims client-side for surfaced cards (no stored snapshot)
function computeSurfacedDims(match, currentProfile) {
  const cp = currentProfile || {};
  const lc = (s) => (s || '').toLowerCase();
  const overlap = (a, b) =>
    (Array.isArray(a) ? a : []).filter((x) =>
      (Array.isArray(b) ? b : []).some((y) => lc(x) === lc(y))
    ).length;

  const sameCollege = match.college && cp.college && lc(match.college) === lc(cp.college);
  const sameSubject = match.study_subject && cp.study_subject && lc(match.study_subject) === lc(cp.study_subject);
  const sameCareer = match.career_field && cp.career_field && lc(match.career_field) === lc(cp.career_field);
  const sameYear = (match.year_of_study || match.year) && (cp.year_of_study || cp.year) && lc(match.year_of_study || match.year) === lc(cp.year_of_study || cp.year);
  const sameStage = (match.project_stage || match.stage) && (cp.project_stage || cp.stage) && lc(match.project_stage || match.stage) === lc(cp.project_stage || cp.stage);

  const goalsOv = overlap(match.goals, cp.goals);
  const desiredOv = overlap(match.desired_connections, cp.desired_connections);
  const circlesOv = overlap(match.social_circles, cp.social_circles);

  const background = Math.min(100, 50 + (sameCollege ? 25 : 0) + (sameSubject ? 10 : 0) + (circlesOv * 8));
  const goals = Math.min(100, 45 + goalsOv * 15 + desiredOv * 10 + (sameCareer ? 15 : 0));
  const network = Math.min(100, 55 + (sameYear ? 25 : 0) + (sameStage ? 20 : 0));
  const stage = Math.min(100, match.score || 72);

  return { background, goals, network, stage };
}

function computeSharedContext(match, userProfile) {
  const lc = (s) => (s || '').toLowerCase();
  const shared = [];

  if (match.college && userProfile?.college && lc(match.college) === lc(userProfile.college))
    shared.push({ type: 'places', title: `Both at ${match.college}`, detail: 'Shared college context provides a natural icebreaker.' });

  if (match.study_subject && userProfile?.study_subject && lc(match.study_subject) === lc(userProfile.study_subject))
    shared.push({ type: 'activity', title: `${match.study_subject} peers`, detail: 'A common academic thread that can anchor your conversation.' });

  if (match.career_field && userProfile?.career_field && lc(match.career_field) === lc(userProfile.career_field))
    shared.push({ type: 'activity', title: `${match.career_field} alignment`, detail: 'Your professional interests are highly compatible.' });

  const goalsOv = (match.goals || []).filter((g) => (userProfile?.goals || []).some((ug) => lc(ug) === lc(g)));
  if (goalsOv.length > 0)
    shared.push({ type: 'activity', title: 'Goal resonance', detail: `You both prioritize: ${goalsOv.slice(0, 2).join(' & ')}.` });

  const circlesOv = (match.social_circles || []).filter((c) => (userProfile?.social_circles || []).some((uc) => lc(uc) === lc(c)));
  if (circlesOv.length > 0)
    shared.push({ type: 'people', title: 'Network overlap', detail: `Connected through: ${circlesOv.slice(0, 2).join(', ')}.` });

  return shared;
}

// ─── CountUp ─────────────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const ctrl = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [target]);
  return <span>{val}{suffix}</span>;
}

// ─── BoltIcon ────────────────────────────────────────────────────────────────
const BoltIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

// ─── NetworkPulse ─────────────────────────────────────────────────────────────
const NetworkPulse = ({ stats }) => {
  const hasConnections = (stats?.active_count ?? 0) > 0;

  if (!hasConnections) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginTop: 24, padding: '0 20px' }}
      >
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: 'var(--text2)', letterSpacing: '0.08em', marginBottom: 12 }}>
          NETWORK PULSE
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            background: 'linear-gradient(165deg, #1A1A1A 0%, #2D2D2D 100%)',
            borderRadius: 24,
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle accent glow */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'var(--accent)', filter: 'blur(60px)', opacity: 0.2 }} />
          
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 26, color: '#FFFEFD', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Build your baseline.
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,254,253,0.7)', lineHeight: 1.6, maxWidth: '90%', marginBottom: 24 }}>
            Connect with surfaced matches below to unlock your compatibility trends, response metrics, and networking velocity.
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,168,90,0.15)', padding: '6px 12px', borderRadius: 999 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Discovery Active</span>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: -10, right: 20, fontSize: 80, opacity: 0.03, pointerEvents: 'none', color: '#FFF' }}>
            <BoltIcon />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  const items = [
    { num: stats?.active_count ?? 0, suffix: '', label: 'Active connections', delta: 'Nice!', pos: true },
    { num: stats?.avg_compat ?? 0, suffix: '%', label: 'Avg compatibility', delta: 'Top 10%', pos: true },
    { num: stats?.response_rate ?? 0, suffix: '%', label: 'Response rate', delta: 'Keep Trying!', pos: true },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 24, padding: '0 20px' }}
    >
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: 'var(--text2)', letterSpacing: '0.08em', marginBottom: 12 }}>
        NETWORK PULSE
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {items.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            style={{
              flex: 1,
              background: 'var(--panel-bg)',
              borderRadius: 18,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              minWidth: 0
            }}
          >
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 28, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              <CountUp target={s.num} suffix={s.suffix} />
            </div>
            <div style={{ marginTop: 6, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 11, color: 'var(--text2)', lineHeight: 1.3, minHeight: 28 }}>
              {s.label}
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: 'inline-block', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10, borderRadius: 999, padding: '2px 8px', lineHeight: 1.3, whiteSpace: 'nowrap', background: s.pos ? 'rgba(34,168,90,0.12)' : 'rgba(216,64,64,0.10)', color: s.pos ? 'var(--success)' : 'var(--error)' }}>
                {s.delta}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};


// ─── SectionLabel ─────────────────────────────────────────────────────────────
const SectionLabel = ({ label, help }) => (
  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: 'var(--text2)', letterSpacing: '0.08em' }}>
    <span>{label}</span>
    {help && <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--text3)', letterSpacing: 0, textTransform: 'none' }}>{help}</span>}
  </div>
);

// ─── CompatPanel ─────────────────────────────────────────────────────────────
const CompatPanel = ({ person, fromNew, onClose, onCTA, currentUserProfileId }) => {
  const [showFullProfile, setShowFullProfile] = useState(false);
  if (!person) return null;

  const score = person.score ?? person.compat ?? 0;
  const dims = person.compat_dims
    ? person.compat_dims
    : (person.surfaced_dims || { background: 60, goals: 60, network: 60, stage: 60 });

  const shared = person.shared || [];

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'absolute', inset: 0, background: 'var(--bg)', borderRadius: 44, overflow: 'hidden', zIndex: 20, display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div style={{ position: 'relative', padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          style={{ position: 'absolute', left: 12, top: 20, width: 44, height: 44, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </motion.button>
        <div style={{ marginTop: 11, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 17, color: 'var(--text)', lineHeight: 1.2 }}>{person.name}</div>
        <div style={{ marginTop: 2, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 13, color: 'var(--text2)' }}>{person.role}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        {/* Radial score — pure SVG arc */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginTop: 16, display: 'flex', justifyContent: 'center', position: 'relative' }}>
          {(() => {
            const r = 44;
            const circ = 2 * Math.PI * r;
            const offset = circ - (score / 100) * circ;
            return (
              <svg width={130} height={130} viewBox="0 0 130 130">
                <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(26,26,26,0.06)" strokeWidth={10} />
                <motion.circle
                  cx={65} cy={65} r={r} fill="none"
                  stroke={compatColor(score)} strokeWidth={10}
                  strokeLinecap="round"
                  transform="rotate(-90 65 65)"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                />
                <text x={65} y={60} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 300, fill: compatColor(score) }}>
                  {score}%
                </text>
                <text x={65} y={82} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, fill: 'var(--text2)', letterSpacing: '0.05em' }}>
                  match
                </text>
              </svg>
            );
          })()}
        </motion.div>

        {/* Why you'd connect */}
        {person.match_reason && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
            style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: 'var(--bubble)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>WHY YOU'D CONNECT</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{person.match_reason}</div>
          </motion.div>
        )}

        {/* Dims breakdown */}
        <SectionLabel label="COMPATIBILITY BREAKDOWN" help="4 dimensions" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
          style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {DIM_DISPLAY.map((d, i) => {
            const val = Math.round(Number(dims[d.key] || 0));
            return (
              <motion.div key={d.key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.35 + i * 0.07 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{d.label}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 11, color: 'var(--text3)' }}>{d.sub}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: d.color }}><CountUp target={val} /></span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(26,26,26,0.06)', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.9, delay: 0.45 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: 6, background: d.color, borderRadius: 999 }} />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Shared context (only if data available) */}
        {shared.length > 0 && (
          <>
            <SectionLabel label="SHARED CONTEXT" />
            <div style={{ marginTop: 10 }}>
              {shared.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.7 + i * 0.08 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < shared.length - 1 ? '1px solid var(--bubble)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--bubble)' }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {s.type === 'people' ? <><circle cx="9" cy="8" r="4" /><circle cx="17" cy="10" r="3" /><path d="M2 20c0-4 3-6 7-6s7 2 7 6" /><path d="M15 20c0-2 2-3.5 4-3.5" /></> :
                        s.type === 'places' ? <><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="2.5" /></> :
                          <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>}
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.3 }}>{s.title}</div>
                    <div style={{ marginTop: 2, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{s.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* CTA */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-light)', padding: '14px 20px 32px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowFullProfile(true)}
          style={{ width: '100%', height: 44, borderRadius: 999, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 14, cursor: 'pointer', background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--border-light)' }}>
          View their profile →
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onCTA}
          style={{ width: '100%', height: 52, borderRadius: 999, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--text)', color: '#fff', border: '1.5px solid var(--border)' }}>
          {fromNew ? 'Open in Inbox' : 'Send a message'}
        </motion.button>
      </div>
      {showFullProfile && (
        <ProfileView
          profileId={!fromNew ? (person?.profile_id || person?.$id) : undefined}
          connectionId={fromNew ? (person?.connection_id || person?.id) : undefined}
          currentUserProfileId={currentUserProfileId}
          onClose={() => setShowFullProfile(false)}
          context="home"
        />
      )}
    </motion.div>
  );
};



// ─── HomeScreen (main) ────────────────────────────────────────────────────────
export default function HomeScreen({ profile, onNavigateToInbox, voltzBalance = 0, onOpenVoltzModal }) {
  const [tab, setTab] = useState('new');
  const [pending, setPending] = useState([]);
  const [surfaced, setSurfaced] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sentProfileIds, setSentProfileIds] = useState(new Set());

  // Overlay state
  const [showNotifications, setShowNotifications] = useState(false);
  const [compatOpen, setCompatOpen] = useState(false);
  const [compatPerson, setCompatPerson] = useState(null);
  const [compatFromNew, setCompatFromNew] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePerson, setComposePerson] = useState(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultPerson, setResultPerson] = useState(null);
  const [resultType, setResultType] = useState('');

  // ── Stats: read instantly from profile, refresh in background ───────────────
  useEffect(() => {
    if (!profile) return;
    if (profile.home_stats_json) {
      try { setStats(JSON.parse(profile.home_stats_json)); } catch {}
    }
    if (CONNECTION_GATEWAY_FUNCTION_ID) {
      executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, { action: 'get_home_feed' })
        .then(data => { if (data?.success) { setStats(data.stats); if (data.pending?.length) setPending(data.pending); } })
        .catch(() => {});
    }
  }, [profile?.$id]);

  // ── Pending connections: fetch directly from DB ───────────────────────────
  useEffect(() => {
    if (!profile?.$id) return;
    const load = async () => {
      try {
        const res = await tables.listRows({
          databaseId: DB_ID,
          tableId: 'connections',
          queries: [
            Query.equal('responder_profile_id', profile.$id),
            Query.equal('status', 'pending'),
            Query.orderDesc('initiated_at'),
            Query.limit(10),
          ],
        });
        const rows = res?.rows || [];
        if (!rows.length) { setLoading(false); return; }
        const initiatorIds = [...new Set(rows.map(r => r.initiator_profile_id).filter(Boolean))];
        const profRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          queries: [Query.equal('$id', initiatorIds), Query.limit(initiatorIds.length)],
        });
        const profMap = Object.fromEntries((profRes?.rows || []).map(p => [p.$id, p]));
        const enriched = rows.map(r => {
          const p = profMap[r.initiator_profile_id];
          if (!p) return null;
          return {
            ...p,
            id: r.$id,
            connection_id: r.$id,
            initiated_at: r.initiated_at,
            message: r.opening_message_preview || 'They would like to connect.',
            score: r.compatibility_score_snapshot ?? 0,
            compat_chips: [],
            name: p.full_name || 'Oxford Member',
            photo_url: getProfilePhotoUrl(p, PHOTO_SIZES.large),
            initials: ((p.full_name || '').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)) || '??',
            color: '#7B5CF0',
            role: [p.career_field, p.study_subject].filter(Boolean).join(' · ') || p.college || 'Oxford',
            profile_id: p.$id,
          };
        }).filter(Boolean);
        setPending(enriched);
      } catch (e) {
        console.error('HomeScreen: pending fetch error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.$id]);

  // ── Auto-tab switching removed — user can always click new connections tab ──

  // ── Fetch surfaced recommendations ─────────────────────────────────────────
  useEffect(() => {
    if (!profile?.$id) return;
    const loadSurfaced = async () => {
      const LOG = (...args) => console.log('[Surfaced]', ...args);
      LOG('Starting. profile.$id =', profile.$id);

      // Show cache immediately while fetching
      const cached = readCacheValue('home_surfaced', SURFACED_TTL);
      if (cached?.length) { LOG('Using cached', cached.length, 'items'); setSurfaced(cached); }

      const skippedRaw = localStorage.getItem(`sc_skipped_${profile.$id}`);
      const skippedIds = new Set(skippedRaw ? JSON.parse(skippedRaw) : []);
      LOG('Skipped IDs:', skippedIds.size);

      // ── Steps 1+2: Fetch queue rows and sent IDs in parallel ─────────────
      let queueItems = [];
      let sentIds = new Set();
      try {
        const [queueRes, sentRes] = await Promise.all([
          tables.listRows({
            databaseId: DB_ID,
            tableId: DISCOVERY_QUEUE_TABLE,
            queries: [
              Query.equal('profile_id', profile.$id),
              Query.equal('status', 'pending'),
              Query.orderDesc('score'),
              Query.limit(30),
            ],
          }),
          tables.listRows({
            databaseId: DB_ID,
            tableId: 'connections',
            queries: [
              Query.equal('initiator_profile_id', profile.$id),
              Query.equal('status', ['pending', 'accepted']),
              Query.limit(200),
            ],
          }),
        ]);
        queueItems = queueRes?.rows || [];
        sentIds = new Set((sentRes?.rows || []).map(r => r.responder_profile_id).filter(Boolean));
        LOG('Queue rows fetched:', queueItems.length, '| Sent IDs:', sentIds.size);
      } catch (e) {
        console.error('[Surfaced] Parallel fetch FAILED:', e?.message, e);
        // Fallback: fetch queue alone without status filter
        try {
          const retryRes = await tables.listRows({
            databaseId: DB_ID,
            tableId: DISCOVERY_QUEUE_TABLE,
            queries: [
              Query.equal('profile_id', profile.$id),
              Query.orderDesc('score'),
              Query.limit(30),
            ],
          });
          queueItems = (retryRes?.rows || []).filter(r => r.status === 'pending');
          LOG('Fallback queue rows:', queueItems.length);
        } catch (e2) {
          console.error('[Surfaced] Fallback also failed:', e2?.message);
        }
      }
      setSentProfileIds(sentIds);

      // Trigger background refill if queue is sparse, then silently append new items
      if (queueItems.length < 8 && DISCOVERY_FUNCTION_ID) {
        LOG('Queue sparse (<8), triggering refill_queue');
        const shownIds = new Set(queueItems.map(item => item.target_profile_id));
        executeFunction(DISCOVERY_FUNCTION_ID, { action: 'refill_queue', profile_id: profile.$id })
          .then(() => appendNewQueueItems(profile.$id, shownIds, sentIds, skippedIds))
          .catch(() => { });
      }

      // ── Step 3: Filter + sort ─────────────────────────────────────────────
      const visible = queueItems
        .filter((item) => {
          const skip = skippedIds.has(item.target_profile_id);
          const sent = sentIds.has(item.target_profile_id);
          if (skip || sent) LOG(`Filtered out ${item.target_profile_id}: skip=${skip} sent=${sent}`);
          return !skip && !sent;
        })
        .sort((a, b) => {
          if (a.status === b.status) return (b.score || 0) - (a.score || 0);
          if (a.status === 'pending') return -1;
          if (b.status === 'pending') return 1;
          return (b.score || 0) - (a.score || 0);
        });
      LOG('Visible after filter:', visible.length);

      if (!visible.length) {
        LOG('No visible items — clearing surfaced');
        if (!cached?.length) setSurfaced([]);
        return;
      }

      // ── Step 4: Batch-fetch profiles ──────────────────────────────────────
      const targetIds = visible.map((item) => item.target_profile_id);
      LOG('Target profile IDs to fetch:', targetIds);
      let profileRows = [];

      // Try batch first
      try {
        const profileRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          queries: [Query.equal('$id', targetIds), Query.limit(targetIds.length)],
        });
        profileRows = profileRes.rows || [];
        LOG('Batch fetch returned:', profileRows.length, '| IDs:', profileRows.map(r => r.$id));
      } catch (e) {
        LOG('Batch fetch threw:', e?.message);
      }

      // If batch returned nothing (query.equal $id array unsupported or IDs are Qdrant UUIDs),
      // fall back to getRow for each ID, and also try user_id lookup as Qdrant UUID conversion
      if (profileRows.length === 0) {
        LOG('Batch returned 0 — falling back to getRow per ID...');
        const rowFetches = targetIds.map(id =>
          tables.getRow({ databaseId: DB_ID, tableId: PROFILES_TABLE, rowId: id })
            .then(row => { if (row) { LOG('getRow hit for', id); return row; } return null; })
            .catch(() => null)
        );
        const rowResults = await Promise.all(rowFetches);
        profileRows = rowResults.filter(Boolean);
        LOG('getRow results:', profileRows.length);

        // Still nothing — IDs are Qdrant UUIDs from old queue entries. Dismiss
        // them all so the queue falls below threshold and triggers a fresh refill
        // with the fixed discoveryEngine that stores Appwrite IDs.
        if (profileRows.length === 0) {
          LOG('IDs are unresolvable (Qdrant UUIDs). Dismissing all', visible.length, 'bad queue entries and triggering refill...');
          visible.forEach(item => {
            if (item.$id && DISCOVERY_FUNCTION_ID) {
              executeFunction(DISCOVERY_FUNCTION_ID, {
                action: 'update_queue_status',
                queueId: item.$id,
                status: 'dismissed',
              }).catch(() => { });
            }
          });
          if (DISCOVERY_FUNCTION_ID) {
            executeFunction(DISCOVERY_FUNCTION_ID, { action: 'refill_queue', profile_id: profile.$id }).catch(() => { });
          }
        }
      }

      // ── Step 5: Enrich and set ────────────────────────────────────────────
      const enriched = visible.map((item) => {
        const p = profileRows.find((r) => r.$id === item.target_profile_id);
        if (!p) {
          LOG('No profile row found for target_profile_id:', item.target_profile_id, '— skipping');
          return null;
        }
        return {
          ...p,
          queue_id: item.$id,
          queue_status: item.status,
          score: item.score ?? 0,
          match_reason: item.match_reason || '',
          photo_url: getProfilePhotoUrl(p, PHOTO_SIZES.large),
          initials: ((p.full_name || '').split(' ').map((x) => x[0]).join('').toUpperCase().slice(0, 2)) || '??',
          color: '#7B5CF0',
          name: p.full_name || 'Unknown',
          role: [p.career_field, p.study_subject].filter(Boolean).join(' · ') || p.college || 'Oxford',
          surfaced_dims: computeSurfacedDims(p, profile),
        };
      }).filter(Boolean);

      LOG('Enriched cards ready:', enriched.length);
      setSurfaced(enriched);
      writeCacheEntry('home_surfaced', enriched);
    };

    // Fetch new queue items after a refill and append them to the displayed list
    const appendNewQueueItems = async (profileId, shownIds, sentIds, skippedIds) => {
      try {
        const newQueueRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: DISCOVERY_QUEUE_TABLE,
          queries: [
            Query.equal('profile_id', profileId),
            Query.equal('status', 'pending'),
            Query.orderDesc('score'),
            Query.limit(30),
          ],
        });
        const newItems = (newQueueRes?.rows || []).filter(
          item => !shownIds.has(item.target_profile_id)
            && !sentIds.has(item.target_profile_id)
            && !skippedIds.has(item.target_profile_id)
        );
        if (!newItems.length) return;

        const newTargetIds = newItems.map(item => item.target_profile_id);
        const profileRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          queries: [Query.equal('$id', newTargetIds), Query.limit(newTargetIds.length)],
        });
        const newProfileRows = profileRes?.rows || [];

        const newCards = newItems.map(item => {
          const p = newProfileRows.find(r => r.$id === item.target_profile_id);
          if (!p) return null;
          return {
            ...p,
            queue_id: item.$id,
            queue_status: item.status,
            score: item.score ?? 0,
            match_reason: item.match_reason || '',
            photo_url: getProfilePhotoUrl(p, PHOTO_SIZES.large),
            initials: ((p.full_name || '').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)) || '??',
            color: '#7B5CF0',
            name: p.full_name || 'Unknown',
            role: [p.career_field, p.study_subject].filter(Boolean).join(' · ') || p.college || 'Oxford',
            surfaced_dims: computeSurfacedDims(p, profile),
          };
        }).filter(Boolean);

        if (newCards.length) {
          setSurfaced(prev => {
            const combined = [...prev, ...newCards];
            writeCacheEntry('home_surfaced', combined);
            return combined;
          });
        }
      } catch (e) {
        console.error('[Surfaced] appendNewQueueItems failed:', e?.message);
      }
    };

    loadSurfaced();
  }, [profile?.$id]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAccept = useCallback(async (p) => {
    try {
      await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: 'accept_connection',
        connection_id: p.connection_id || p.id,
      });
    } catch (e) {
      console.error('HomeScreen: accept error', e);
    }
    track.connectionAccepted(p.connection_id || p.id);
    setPending((prev) => prev.filter((c) => c.id !== p.id));
    setResultPerson(p);
    setResultType('accepted');
    setResultOpen(true);
    // Auto-navigate to inbox after showing the success state briefly
    setTimeout(() => {
      setResultOpen(false);
      onNavigateToInbox(null);
    }, 1800);
  }, [onNavigateToInbox]);

  const handleDecline = useCallback(async (p) => {
    try {
      await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: 'decline_connection',
        connection_id: p.connection_id || p.id,
      });
    } catch (e) {
      console.error('HomeScreen: decline error', e);
    }
    track.connectionDeclined(p.connection_id || p.id);
    setPending((prev) => prev.filter((c) => c.id !== p.id));
  }, []);

  const handleCompatTap = useCallback((p, kind) => {
    const isNew = kind === 'new';
    setCompatPerson({
      ...p,
      compat_dims: isNew ? p.compat_dims : p.surfaced_dims,
      shared: isNew
        ? (p.compat_chips || []).map((chip) => ({ type: 'activity', title: chip.label, detail: '' }))
        : computeSharedContext(p, profile),
    });
    setCompatFromNew(isNew);
    track.compatPanelOpened(p.$id || p.profile_id, p.score ?? p.compat ?? 0);
    setCompatOpen(true);
  }, [profile]);

  const handleCompatCTA = useCallback(() => {
    setCompatOpen(false);
    setTimeout(() => {
      if (compatFromNew) {
        onNavigateToInbox();
      } else {
        setComposePerson(compatPerson);
        setComposeOpen(true);
      }
    }, 250);
  }, [compatFromNew, compatPerson, onNavigateToInbox]);

  const handleSkip = useCallback((p) => {
    track.surfacedCardSkipped(p.target_profile_id || p.$id);
    if (p?.queue_id) {
      executeFunction(DISCOVERY_FUNCTION_ID, {
        action: 'update_queue_status',
        queueId: p.queue_id,
        status: 'dismissed'
      }).catch(() => { });
    }
    setSurfaced((prev) => {
      const next = prev.filter((x) => (x.queue_id || x.$id) !== (p.queue_id || p.$id));
      if (next.length < 8 && DISCOVERY_FUNCTION_ID && profile?.$id) {
        const shownIds = new Set(next.map(x => x.target_profile_id || x.$id));
        const skipped = new Set(JSON.parse(localStorage.getItem(`sc_skipped_${profile.$id}`) || '[]'));
        executeFunction(DISCOVERY_FUNCTION_ID, { action: 'refill_queue', profile_id: profile.$id })
          .then(() => tables.listRows({
            databaseId: DB_ID,
            tableId: DISCOVERY_QUEUE_TABLE,
            queries: [Query.equal('profile_id', profile.$id), Query.equal('status', 'pending'), Query.orderDesc('score'), Query.limit(30)],
          }))
          .then(async (qRes) => {
            const newItems = (qRes?.rows || []).filter(item =>
              !shownIds.has(item.target_profile_id) && !sentProfileIds.has(item.target_profile_id) && !skipped.has(item.target_profile_id));
            if (!newItems.length) return;
            const ids = newItems.map(i => i.target_profile_id);
            const pRes = await tables.listRows({ databaseId: DB_ID, tableId: PROFILES_TABLE, queries: [Query.equal('$id', ids), Query.limit(ids.length)] });
            const cards = newItems.map(item => {
              const p2 = (pRes?.rows || []).find(r => r.$id === item.target_profile_id);
              if (!p2) return null;
              return {
                ...p2, queue_id: item.$id, score: item.score ?? 0, match_reason: item.match_reason || '',
                photo_url: getProfilePhotoUrl(p2, PHOTO_SIZES.large),
                initials: ((p2.full_name || '').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)) || '??',
                color: '#7B5CF0', name: p2.full_name || 'Unknown',
                role: [p2.career_field, p2.study_subject].filter(Boolean).join(' · ') || p2.college || 'Oxford',
                surfaced_dims: computeSurfacedDims(p2, profile),
              };
            }).filter(Boolean);
            if (cards.length) setSurfaced(prev2 => { const c = [...prev2, ...cards]; writeCacheEntry('home_surfaced', c); return c; });
          })
          .catch(() => {});
      }
      return next;
    });
  }, [profile?.$id, sentProfileIds]);

  const handleConnect = useCallback((p) => {
    track.userAction('connect_button_tapped', { targetId: p.$id || p.profile_id, score: p.score ?? 0 });
    setComposePerson(p);
    setComposeOpen(true);
  }, []);

  const handleSend = useCallback(async (message) => {
    const target = composePerson;
    // We don't close composeOpen here anymore so the background doesn't shift

    // Update queue status
    if (target?.queue_id) {
      executeFunction(DISCOVERY_FUNCTION_ID, {
        action: 'update_queue_status',
        queueId: target.queue_id,
        status: 'connected'
      }).catch(() => { });
    }

    const targetId = target?.$id || target?.profile_id;
    if (targetId) {
      setSurfaced((prev) => prev.filter((x) => (x.$id || x.profile_id) !== targetId));
      setSentProfileIds((prev) => new Set([...prev, targetId]));
    }

    // Show result immediately
    track.connectionSent(target?.$id || target?.profile_id);
    setResultPerson(target);
    setResultType('sent');
    setResultOpen(true);

    try {
      await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: 'initiate_request',
        target_profile_id: target?.$id || target?.profile_id || target?.user_id,
        target_user_id: target?.user_id,
        opening_message: message,
      });
    } catch (e) {
      console.error('HomeScreen: initiate_request error', e);
    }
  }, [composePerson]);

  const deck = tab === 'new' ? pending : surfaced;
  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'there';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>

        {/* Header — icons row */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNotifications(true)}
            style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', position: 'relative' }}>
            <Bell size={20} strokeWidth={1.6} />
            {pending.length > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--error)', color: '#fff', fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)', lineHeight: 1 }}>
                {pending.length > 9 ? '9+' : pending.length}
              </span>
            )}
          </motion.button>
          <VoltzWallet balance={voltzBalance} onBuyMore={onOpenVoltzModal} />
        </motion.div>

        {/* Greeting block */}
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 28, lineHeight: 1.1, color: 'var(--text)', letterSpacing: '-0.015em' }}>
            {greeting}, {firstName}
          </div>
          <div style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 13, color: 'var(--text2)' }}>
            {loading ? 'Loading…' : `${pending.length} ${pending.length === 1 ? 'person is' : 'people are'} waiting for you`}
          </div>
        </div>

        <NetworkPulse stats={stats} />

        {/* Tabs */}
        <div style={{ padding: '20px 20px 8px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'new', label: 'New Connections', count: pending.length },
              { key: 'surfaced', label: 'Surfaced For You', count: surfaced.length },
            ].map(({ key, label, count }) => {
              const active = tab === key;
              return (
                <motion.div key={key} whileTap={{ scale: 0.97 }} onClick={() => setTab(key)}
                  style={{ position: 'relative', borderRadius: 999, padding: '9px 20px', fontFamily: 'var(--font-sans)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', height: 40, display: 'inline-flex', alignItems: 'center', background: active ? 'var(--text)' : 'var(--bg)', color: active ? '#fff' : 'var(--text)', fontWeight: active ? 600 : 400, border: '1.5px solid var(--border)', transition: 'background 240ms ease, color 240ms ease' }}>
                  {label}
                  {count > 0 && (
                    <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--error)', color: '#fff', fontWeight: 600, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>
                      {count}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Card stack */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}>
            <CardStack
              deck={deck}
              tab={tab}
              onAccept={handleAccept}
              onConnect={handleConnect}
              onCompatTap={handleCompatTap}
              onSkip={handleSkip}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {compatOpen && (
          <CompatPanel
            person={compatPerson}
            fromNew={compatFromNew}
            onClose={() => setCompatOpen(false)}
            onCTA={handleCompatCTA}
            currentUserProfileId={profile?.$id}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {composeOpen && (
          <ComposeScreen
            person={composePerson}
            onClose={() => setComposeOpen(false)}
            onSend={handleSend}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {resultOpen && (
          <ConnectionResult
            person={resultPerson}
            type={resultType}
            onStartChatting={() => {
              setResultOpen(false);
              setComposeOpen(false);
              onNavigateToInbox(resultType === 'accepted' ? null : 'sent');
            }}
            onBack={() => {
              setResultOpen(false);
              setComposeOpen(false);
            }}
          />
        )}
      </AnimatePresence>
      {showNotifications && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 400, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <NotificationsPanel
            notifications={[]}
            onBack={() => setShowNotifications(false)}
            onMarkAllRead={() => { }}
          />
        </div>
      )}
    </div>
  );
}