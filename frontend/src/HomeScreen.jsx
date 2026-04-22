import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Search } from 'lucide-react';
import {
  functions,
  storage,
  PROFILE_PHOTOS_BUCKET_ID,
  CONNECTION_GATEWAY_FUNCTION_ID,
  DISCOVERY_FUNCTION_ID,
} from './lib/appwrite';
import { readCacheValue, writeCacheEntry } from './lib/cache';

import ComposeScreen from './components/ComposeScreen';
import ConnectionResult from './components/ConnectionResult';
import { CardPhoto, Chip, CardButton, NewConnectionCard, SurfacedCard, CardStack } from './components/HomeCards';
import { VoltzWallet } from './components/VoltzSystem';
// ─── Cache TTLs ───────────────────────────────────────────────────────────────
const HOME_FEED_TTL = 2 * 60 * 1000;
const SURFACED_TTL  = 5 * 60 * 1000;

// ─── Execute an Appwrite function ─────────────────────────────────────────────
async function executeFunction(functionId, payload) {
  const exec = await functions.createExecution(functionId, JSON.stringify(payload), false);
  return JSON.parse(exec.responseBody);
}

// ─── Build a storage photo URL (frontend SDK) ─────────────────────────────────
function buildPhotoUrl(photoFileIds) {
  const ids = Array.isArray(photoFileIds) ? photoFileIds : [];
  const first = ids.find((id) => typeof id === 'string' && id.trim());
  if (!first) return null;
  try {
    return String(storage.getFileView({ bucketId: PROFILE_PHOTOS_BUCKET_ID, fileId: first }));
  } catch {
    return null;
  }
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
const compatColor = (score) => {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--dim-network)';
  return 'var(--text2)';
};

// Map compat snapshot breakdown keys → display dimensions
const DIM_DISPLAY = [
  { key: 'background', label: 'Identity',   sub: 'Who you are',     color: 'var(--dim-identity)'  },
  { key: 'goals',      label: 'Intent',     sub: 'What you want',   color: 'var(--dim-intent)'    },
  { key: 'network',    label: 'Resonance',  sub: 'How you click',   color: 'var(--dim-resonance)' },
  { key: 'stage',      label: 'Network',    sub: 'Who you both know',color: 'var(--dim-network)'  },
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
  const sameCareer  = match.career_field && cp.career_field && lc(match.career_field) === lc(cp.career_field);
  const goalsOv     = overlap(match.goals, cp.goals);
  const desiredOv   = overlap(match.desired_connections, cp.desired_connections);
  const circlesOv   = overlap(match.social_circles, cp.social_circles);

  return {
    background: Math.min(100, 50 + (sameCollege ? 24 : 0) + (sameCareer ? 12 : 0)),
    goals:      Math.min(100, 46 + goalsOv * 15 + desiredOv * 9),
    network:    Math.min(100, 50 + circlesOv * 12),
    stage:      Math.min(100, 50 + (goalsOv + desiredOv) * 8),
  };
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
  const items = [
    { num: stats?.active_count ?? 0,  suffix: '',  label: 'Active connections', delta: '+12 this month', pos: true  },
    { num: stats?.avg_compat    ?? 0,  suffix: '%', label: 'Avg compatibility',  delta: '+3 pts',        pos: true  },
    { num: stats?.response_rate ?? 0,  suffix: '%', label: 'Response rate',      delta: '−4 pts',        pos: false },
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
const CompatPanel = ({ person, fromNew, onClose, onCTA }) => {
  if (!person) return null;

  const score = person.score ?? person.compat ?? 0;
  const dims  = person.compat_dims
    ? person.compat_dims
    : (person.surfaced_dims || { background: 60, goals: 60, network: 60, stage: 60 });

  const radialData = [{ name: 'compat', value: score, fill: compatColor(score) }];

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
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 17, color: 'var(--text)', lineHeight: 1.2 }}>{person.name}</div>
        <div style={{ marginTop: 2, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 13, color: 'var(--text2)' }}>{person.role}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        {/* Radial score */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginTop: 16, display: 'flex', justifyContent: 'center', height: 130, position: 'relative' }}>
          <ResponsiveContainer width={130} height={130}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={10} data={radialData} startAngle={90} endAngle={90 - (score / 100) * 360}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: 'rgba(26,26,26,0.06)' }} dataKey="value" cornerRadius={999} isAnimationActive animationDuration={900} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 32, lineHeight: 1, letterSpacing: '-0.02em', color: compatColor(score) }}>
              <CountUp target={score} suffix="%" />
            </div>
            <div style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12, color: 'var(--text2)', letterSpacing: '0.05em' }}>match</div>
          </div>
        </motion.div>

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
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-light)', padding: '14px 20px 32px', background: 'var(--bg)' }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onCTA}
          style={{ width: '100%', height: 52, borderRadius: 999, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--text)', color: '#fff', border: '1.5px solid var(--border)' }}>
          {fromNew ? 'Open in Inbox' : 'Send a message'}
        </motion.button>
      </div>
    </motion.div>
  );
};



// ─── HomeScreen (main) ────────────────────────────────────────────────────────
export default function HomeScreen({ profile, onNavigateToInbox, onNavigateToSearch, voltzBalance = 0, onOpenVoltzModal }) {
  const [tab, setTab]                   = useState('new');
  const [pending, setPending]           = useState([]);
  const [surfaced, setSurfaced]         = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);

  // Overlay state
  const [compatOpen, setCompatOpen]     = useState(false);
  const [compatPerson, setCompatPerson] = useState(null);
  const [compatFromNew, setCompatFromNew] = useState(false);
  const [composeOpen, setComposeOpen]   = useState(false);
  const [composePerson, setComposePerson] = useState(null);
  const [resultOpen, setResultOpen]         = useState(false);
  const [resultPerson, setResultPerson]     = useState(null);
  const [resultType, setResultType]         = useState('');

  // ── Fetch home feed (pending + stats) ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const cached = readCacheValue('home_feed', HOME_FEED_TTL);
      if (cached) {
        setPending(cached.pending || []);
        setStats(cached.stats || null);
        setLoading(false);
      }
      try {
        const data = await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, { action: 'get_home_feed' });
        if (data.success) {
          setPending(data.pending || []);
          setStats(data.stats || null);
          writeCacheEntry('home_feed', { pending: data.pending, stats: data.stats });
        }
      } catch (e) {
        console.error('HomeScreen: home_feed error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);
  
  // ── Auto-tab switching ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && pending.length === 0 && tab === 'new') {
      setTab('surfaced');
    }
  }, [pending.length, loading, tab]);

  // ── Fetch surfaced recommendations ─────────────────────────────────────────
  useEffect(() => {
    if (!profile?.$id || !DISCOVERY_FUNCTION_ID) return;
    const loadSurfaced = async () => {
      const cached = readCacheValue('home_surfaced', SURFACED_TTL);
      if (cached) setSurfaced(cached);
      try {
        const data = await executeFunction(DISCOVERY_FUNCTION_ID, { action: 'recommend', docId: profile.$id });
        if (data.matches) {
          // Enrich with photo URL built from photo_file_ids in Qdrant payload
          const enriched = data.matches.map((m) => ({
            ...m,
            photo_url: buildPhotoUrl(m.photo_file_ids),
            score: m.score ?? Math.round((m.compatibility_score || 0) * 100),
            initials: ((m.full_name || '').split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)) || '??',
            color: '#7B5CF0',
            name: m.full_name || 'Unknown',
            role: [m.career_field, m.study_subject].filter(Boolean).join(' · ') || m.college || 'Oxford',
            surfaced_dims: computeSurfacedDims(m, profile),
          }));
          setSurfaced(enriched);
          writeCacheEntry('home_surfaced', enriched);
        }
      } catch (e) {
        console.error('HomeScreen: surfaced error', e);
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
    setPending((prev) => prev.filter((c) => c.id !== p.id));
    setResultPerson(p);
    setResultType('accepted');
    setResultOpen(true);
  }, []);

  const handleDecline = useCallback(async (p) => {
    try {
      await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: 'decline_connection',
        connection_id: p.connection_id || p.id,
      });
    } catch (e) {
      console.error('HomeScreen: decline error', e);
    }
    setPending((prev) => prev.filter((c) => c.id !== p.id));
  }, []);

  const handleCompatTap = useCallback((p, kind) => {
    const isNew = kind === 'new';
    setCompatPerson({
      ...p,
      compat_dims: isNew ? p.compat_dims : p.surfaced_dims,
    });
    setCompatFromNew(isNew);
    setCompatOpen(true);
  }, []);

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

  const handleConnect = useCallback((p) => {
    setComposePerson(p);
    setComposeOpen(true);
  }, []);

  const handleSend = useCallback(async (message) => {
    const target = composePerson;
    setComposeOpen(false);
    try {
      await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: 'initiate_request',
        target_profile_id: target?.$id || target?.user_id,
        target_user_id: target?.user_id,
        opening_message: message,
      });
    } catch (e) {
      console.error('HomeScreen: initiate_request error', e);
    }
    setResultPerson(target);
    setResultType('sent');
    setResultOpen(true);
  }, [composePerson]);

  const deck = tab === 'new' ? pending : surfaced;
  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'there';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 30, lineHeight: 1.1, color: 'var(--text)', letterSpacing: '-0.015em' }}>
              {greeting}, {firstName}
            </div>
            <div style={{ marginTop: 5, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>
              {loading ? 'Loading…' : `${pending.length} ${pending.length === 1 ? 'person is' : 'people are'} waiting for you`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onNavigateToSearch}
              style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
              <Search size={22} strokeWidth={1.6} />
            </motion.button>
            <VoltzWallet balance={voltzBalance} onBuyMore={onOpenVoltzModal} />
          </div>
        </motion.div>

        <NetworkPulse stats={stats} />

        {/* Tabs */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', padding: '20px 20px 8px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'new',      label: 'New Connections', count: pending.length },
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
              onNavigateToInbox();
            }}
            onBack={() => setResultOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
