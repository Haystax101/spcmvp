import React, { useState, useEffect, useRef } from 'react';
import { functions, DISCOVERY_FUNCTION_ID, CONNECTION_GATEWAY_FUNCTION_ID } from '../lib/appwrite';
import { readCacheValue, writeCacheEntry } from '../lib/cache';
import ProfileView from './ProfileView';

// ─── Design tokens (matches the HTML prototype) ──────────────────────────────
const C = {
  ink: '#1a1a1a',
  inkMuted: '#6b6b6b',
  inkFaint: '#a0a0a0',
  paper: '#ffffff',
  warmGrey: '#f5f4f0',
  warmGreyBorder: '#ececea',
  greenBg: '#C0DD97',
  greenFill: '#639922',
  greenText: '#3B6D11',
  greenChipBg: '#EAF3DE',
  amberBg: '#fdf3e7',
  amberFill: '#C88420',
  amberText: '#8C5A14',
  coralBg: '#fbe6e1',
  coralText: '#A63E28',
  dimIdentity: '#3E66C6',
  dimIntent: '#2B9A87',
  dimResonance: '#7C5AC4',
  dimNetwork: '#C88420',
};

const AVATAR_PALETTE = [
  { bg: '#E4D8F3', fg: '#5B3E96' },
  { bg: '#D6EDE7', fg: '#23705E' },
  { bg: '#F7DCD2', fg: '#A63E28' },
  { bg: '#E0EDD0', fg: '#3B6D11' },
];

const KEYWORD_COLOUR_POOL = [
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#FAEEDA', fg: '#633806' },
  { bg: '#FAECE7', fg: '#712B13' },
  { bg: '#E1F5EE', fg: '#085041' },
];
const kwCache = {};
let kwIdx = 0;
function kwColor(kw) {
  if (!kwCache[kw]) kwCache[kw] = KEYWORD_COLOUR_POOL[kwIdx++ % KEYWORD_COLOUR_POOL.length];
  return kwCache[kw];
}

const BoltIcon = ({ size = 14, color = '#92400E' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color }}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

const SUGGESTION_CHIPS = [
  'AI founders in Oxford',
  'Research collaborators',
  'Co-founders needed',
  'Oxford entrepreneurs',
  'Study partners',
  'People into deep work',
];

const SEARCH_PLACEHOLDERS = [
  'AI founders in Oxford',
  'Someone to do startups with',
  'Research collaborators in biology',
  'People building in fintech',
  'Co-founders who can build',
  'Study partners for finals',
  'Someone into deep work and philosophy',
  'Oxford entrepreneurs in consulting',
];

const SEARCH_KEYFRAMES = `
  @keyframes sc-circle-in {
    from { clip-path: circle(0% at calc(100% - 40px) 8px); }
    to   { clip-path: circle(160% at calc(100% - 40px) 8px); }
  }
  @keyframes sc-fade-slide-in {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sc-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sc-pulse-in {
    0%   { opacity: 0; transform: scale(0.9); }
    60%  { opacity: 1; transform: scale(1.04); }
    100% { transform: scale(1); }
  }
  @keyframes sc-shimmer {
    0%,100% { opacity: 0.35; }
    50%     { opacity: 0.7; }
  }
  @keyframes sc-card-in {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sc-push-in {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
  @keyframes sc-placeholder-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function callDiscovery(body) {
  const exec = await functions.createExecution(DISCOVERY_FUNCTION_ID, JSON.stringify(body), false);
  return JSON.parse(exec.responseBody);
}

function avatarPalette(idx) { return AVATAR_PALETTE[idx % AVATAR_PALETTE.length]; }

function computeSurfacedDims(match, cp = {}) {
  const lc = (s) => (s || '').toLowerCase();
  const ov = (a, b) => (Array.isArray(a) ? a : []).filter((x) => (Array.isArray(b) ? b : []).some((y) => lc(x) === lc(y))).length;
  const sameCollege = match.college && cp.college && lc(match.college) === lc(cp.college);
  const sameCareer  = match.career_field && cp.career_field && lc(match.career_field) === lc(cp.career_field);
  const goalsOv = ov(match.goals, cp.goals);
  const desiredOv = ov(match.desired_connections, cp.desired_connections);
  const circlesOv = ov(match.social_circles, cp.social_circles);
  return {
    identity:  Math.min(100, 50 + (sameCollege ? 24 : 0) + (sameCareer ? 12 : 0)),
    intent:    Math.min(100, 46 + goalsOv * 15 + desiredOv * 9),
    resonance: Math.min(100, 50 + circlesOv * 12),
    network:   Math.min(100, 50 + (goalsOv + desiredOv) * 8),
  };
}

function enrichMatch(m, profile, idx) {
  // Name-search results nest the profile row under a `profile` key.
  // Flatten it so $id / user_id / full_name etc. are available at the top level.
  const flat = m.profile ? { ...m.profile, ...m, profile: undefined } : m;

  const dims = computeSurfacedDims(flat, profile);
  const name = flat.full_name || 'Unknown';
  const initials = name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) || '??';
  const role = [flat.career_field, flat.college].filter(Boolean).join(' · ') || 'Oxford';
  const isNameSearch = !!m.profile;
  const dimAvg = Math.round(Object.values(dims).reduce((a, b) => a + b, 0) / 4);
  const score = isNameSearch
    ? dimAvg
    : (flat.score ?? Math.round((flat.compatibility_score || 0) * 100));

  // Derive keyword chips from shared attributes
  const matched = [];
  if (flat.career_field) matched.push(flat.career_field);
  if (flat.college && profile?.college && flat.college.toLowerCase() === profile.college.toLowerCase()) matched.push('Same college');
  if (flat.primary_intent) matched.push(flat.primary_intent);
  if (matched.length === 0 && flat.study_subject) matched.push(flat.study_subject);

  // Timing signal — key facts about the person
  const timingSignal = [flat.career_field, flat.college, flat.year_of_study]
    .filter(Boolean).join(' · ')
    || `${name.split(' ')[0]} is active on Supercharged.`;

  // Suggested opener based on shared goals or career overlap
  const firstName = name.split(' ')[0];
  const sharedGoals = Array.isArray(flat.goals) && Array.isArray(profile?.goals)
    ? flat.goals.filter((g) => (profile.goals || []).some((pg) => pg.toLowerCase() === g.toLowerCase()))
    : [];
  const opener = sharedGoals.length > 0
    ? `You both care about ${sharedGoals.slice(0, 2).join(' and ')} — good starting point.`
    : flat.career_field
    ? `${firstName} is working in ${flat.career_field}${flat.college ? ` at ${flat.college}` : ''} — worth a conversation.`
    : `${firstName} is active on Supercharged and open to new connections.`;

  return {
    ...flat,
    name, initials, role, score, matched,
    timingSignal, opener,
    dims,
    palette: idx % 4,
    gradient: ['linear-gradient(160deg,#8B7FE8 0%,#5B4FCF 100%)', 'linear-gradient(160deg,#5FBCA7 0%,#1F7A6A 100%)', 'linear-gradient(160deg,#E89B85 0%,#B35A3D 100%)', 'linear-gradient(160deg,#7BA0D4 0%,#3A609E 100%)'][idx % 4],
    is_external: !!flat.is_external,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SearchInput({ query, setQuery, inputRef, onSubmit }) {
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderKey, setPlaceholderKey] = useState(0);

  useEffect(() => {
    if (query) return;
    const t = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % SEARCH_PLACEHOLDERS.length);
      setPlaceholderKey(k => k + 1);
    }, 3000);
    return () => clearInterval(t);
  }, [query]);

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <div style={{ position: 'relative', background: C.paper, border: `1.5px solid ${C.ink}`, borderRadius: 16, padding: '14px 14px 52px 14px', minHeight: 110, animation: 'sc-fade-slide-in 220ms ease-out 150ms both' }}>
      {!query && (
        <div key={placeholderKey} style={{ position: 'absolute', top: 14, left: 14, right: 90, color: `${C.ink}55`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4, pointerEvents: 'none', animation: 'sc-placeholder-in 300ms ease-out both', userSelect: 'none' }}>
          {SEARCH_PLACEHOLDERS[placeholderIdx]}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={query}
        rows={2}
        placeholder=""
        onChange={(e) => { setQuery(e.target.value); autoResize(e); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && query.trim()) { e.preventDefault(); onSubmit(query.trim()); } }}
        style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 16, fontFamily: "'DM Sans', sans-serif", color: C.ink, resize: 'none', overflow: 'hidden', lineHeight: 1.4, padding: 0, minHeight: 44, maxHeight: 200, display: 'block' }}
      />
      <button
        onClick={() => query.trim() && onSubmit(query.trim())}
        style={{ position: 'absolute', bottom: 12, right: 12, background: C.ink, color: C.paper, border: 'none', borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: query.trim() ? 'pointer' : 'default', opacity: query.trim() ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 5, transition: 'opacity 160ms ease' }}>
        Find
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  );
}

function ScopeToggle({ scope, setScope }) {
  const [showExternalInfo, setShowExternalInfo] = React.useState(false);
  return (
    <div style={{ marginTop: 14, animation: 'sc-fade-slide-in 220ms ease-out 180ms both' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Internal button — fully active */}
        <button onClick={() => setScope('internal')}
          style={{ background: scope === 'internal' ? C.ink : C.paper, border: `1.5px solid ${C.ink}`, borderRadius: 999, padding: '8px 22px', fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: scope === 'internal' ? C.paper : C.ink, cursor: 'pointer', transition: 'all 160ms ease-out' }}>
          Internal
        </button>

        {/* External button — greyed out, with info dot badge */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button disabled
            style={{ background: C.paper, border: `1.5px solid ${C.ink}`, borderRadius: 999, padding: '8px 22px', fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: C.ink, cursor: 'default', opacity: 0.38 }}>
            External
          </button>
          {/* Notification dot badge */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowExternalInfo(v => !v); }}
            style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${C.paper}`, background: C.ink, color: C.paper, fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1, zIndex: 1 }}>
            i
          </button>
          {/* Tooltip */}
          {showExternalInfo && (
            <div
              onClick={() => setShowExternalInfo(false)}
              style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 9999, background: C.ink, color: C.paper, fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, padding: '10px 14px', borderRadius: 12, whiteSpace: 'normal', width: 220, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', cursor: 'pointer' }}>
              We're bringing the ability to search beyond Supercharged very soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DimBar({ label, desc, score, color, delay }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(score), delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: C.ink }}>{label}</span>
          <span style={{ color: C.inkMuted, marginLeft: 6 }}>· {desc}</span>
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 20, fontWeight: 500, color }}>{score}</div>
      </div>
      <div style={{ height: 4, background: C.warmGrey, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 999, transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
    </div>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function SearchView({ onBack, query, setQuery, scope, setScope, onSubmit, inputRef }) {
  const [selectedChips, setSelectedChips] = useState([]);

  const toggleChip = (chip) => {
    setSelectedChips((prev) => {
      const next = prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip];
      const newQ = next.join(', ');
      setQuery(newQ);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
      });
      return next;
    });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.paper, animation: 'sc-circle-in 300ms ease-in-out forwards', clipPath: 'circle(0% at calc(100% - 40px) 8px)', display: 'flex', flexDirection: 'column', padding: '16px 0 0', overflowY: 'auto' }}>
      {/* Centred content block */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 56px' }}>
        
        {/* Header */}
        <div style={{ fontSize: 26, fontWeight: 300, fontFamily: 'var(--font-serif)', color: C.ink, marginBottom: 18, letterSpacing: '-0.015em', animation: 'sc-fade-slide-in 220ms ease-out 80ms both' }}>
          Who are you looking for?
        </div>

        <SearchInput query={query} setQuery={setQuery} inputRef={inputRef} onSubmit={onSubmit} />
        <ScopeToggle scope={scope} setScope={setScope} />

        {/* Label */}
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', color: C.inkMuted, textTransform: 'uppercase', marginTop: 28, marginBottom: 14, animation: 'sc-fade-slide-in 220ms ease-out 220ms both' }}>
          Try searching for
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTION_CHIPS.map((chip, i) => {
            const sel = selectedChips.includes(chip);
            return (
              <button key={chip} onClick={() => toggleChip(chip)}
                style={{ background: sel ? C.ink : C.paper, border: `1.5px solid ${C.ink}`, color: sel ? C.paper : C.ink, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", padding: '7px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all 140ms ease-out', animation: `sc-fade-up 150ms ease-out ${250 + i * 30}ms both` }}>
                {chip}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultsView({ query, results, loading, onClear, onBack, onOpenProfile, onConnect }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.paper, padding: '20px 16px 40px', overflowY: 'auto' }}>
      {/* Back */}
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: 0, marginBottom: 14, fontSize: 14, fontWeight: 500, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span> Back
      </button>

      {/* Query bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.warmGrey, border: `1px solid ${C.warmGreyBorder}`, borderRadius: 999, padding: '11px 16px' }}>
        <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
          <circle cx="10" cy="10" r="7" stroke={C.ink} strokeWidth="1.6" />
          <path d="M15 15 L20 20" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span style={{ flex: 1, fontSize: 15, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>{query}</span>
        <button onClick={onClear} style={{ background: C.ink, color: C.paper, border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      {/* Count */}
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', color: C.inkMuted, textTransform: 'uppercase', marginTop: 22, marginBottom: 14, paddingLeft: 4 }}>
        {loading ? 'Searching…' : `${results.length} people · ranked by compatibility`}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[0,1,2].map((i) => (
            <div key={i} style={{ height: 130, background: C.warmGrey, borderRadius: 16, animation: 'sc-shimmer 1s ease-in-out infinite' }} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', fontSize: 14, color: C.inkMuted, fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
          No connections found in this dimensional space.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {results.map((person, i) => (
            <ResultCard key={person.user_id || i} person={person} index={i} onOpenProfile={() => onOpenProfile(person)} onConnect={() => onConnect(person)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ person, index, onOpenProfile, onConnect }) {
  const p = avatarPalette(person.palette);
  const s = person.score || 0;
  const matchBg = s >= 85 ? C.greenBg : s >= 70 ? '#f3e1bd' : C.coralBg;
  const matchFg = s >= 85 ? '#2a4f0a' : s >= 70 ? C.amberText : C.coralText;

  return (
    <div style={{ background: C.paper, border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 16, padding: 18, animation: `sc-card-in 180ms ease-out ${index * 70}ms both`, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      {/* Top — avatar + name + match */}
      <div onClick={onOpenProfile} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: p.bg, color: p.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
          {person.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>{person.name}</div>
          <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{person.role}</div>
        </div>
        <div style={{ background: matchBg, color: matchFg, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
          {s}%
        </div>
      </div>

      {/* Keyword chips */}
      {person.matched?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {person.matched.slice(0, 4).map((kw) => {
            const kc = kwColor(kw);
            return (
              <span key={kw} style={{ background: kc.bg, color: kc.fg, fontSize: 11, fontWeight: 500, padding: '3px 9px 3px 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: kc.fg }} />{kw}
              </span>
            );
          })}
        </div>
      )}

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onOpenProfile} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.ink}`, color: C.ink, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", padding: '9px 12px', borderRadius: 999, cursor: 'pointer' }}>
          View compatibility
        </button>
        <button onClick={onConnect} style={{ flex: 1, background: C.ink, border: 'none', color: C.paper, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", padding: '9px 12px', borderRadius: 999, cursor: 'pointer' }}>
          Connect
        </button>
      </div>
    </div>
  );
}

function ProfileDetailView({ person, onBack, onConnect }) {
  const [ringPct, setRingPct] = useState(0);
  const [displayedPct, setDisplayedPct] = useState(0);
  const [showFullProfile, setShowFullProfile] = useState(false);

  const ringR = 44;
  const ringC = 2 * Math.PI * ringR;
  const score = person.score || 0;
  const p = avatarPalette(person.palette);
  const ringColor = score >= 85 ? C.greenFill : score >= 70 ? C.amberFill : C.coralText;
  const ringTrack = score >= 85 ? '#e9efe0' : score >= 70 ? '#f3ead9' : '#f5e0dd';

  useEffect(() => {
    const t = setTimeout(() => setRingPct(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedPct(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const delay = setTimeout(() => { raf = requestAnimationFrame(tick); }, 100);
    return () => { clearTimeout(delay); if (raf) cancelAnimationFrame(raf); };
  }, [score]);

  const dashOffset = ringC - (ringC * ringPct) / 100;

  const dims = person.dims || { identity: 60, intent: 60, resonance: 60, network: 60 };
  const DIM_ROWS = [
    { key: 'identity',  label: 'Identity',  desc: 'Who you are',      color: C.dimIdentity  },
    { key: 'intent',    label: 'Intent',     desc: 'What you want',    color: C.dimIntent    },
    { key: 'resonance', label: 'Resonance',  desc: 'How you click',    color: C.dimResonance },
    { key: 'network',   label: 'Network',    desc: 'Who you both know',color: C.dimNetwork   },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.paper, animation: 'sc-push-in 300ms ease-out', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Header */}
        <div style={{ padding: '14px 24px 18px', display: 'grid', gridTemplateColumns: '24px 1fr 24px', alignItems: 'center', gap: 8, animation: 'sc-fade-up 400ms ease-out 50ms both' }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 22, lineHeight: 1, color: C.ink, cursor: 'pointer', justifySelf: 'start' }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>{person.name}</div>
            <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{person.role}</div>
          </div>
          <span />
        </div>

        {/* Match ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6, marginBottom: 14, animation: 'sc-fade-up 400ms ease-out 150ms both' }}>
          <div style={{ position: 'relative', width: 110, height: 110 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={ringR} stroke={ringTrack} strokeWidth="7" fill="none" />
              <circle cx="55" cy="55" r={ringR} stroke={ringColor} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={dashOffset} transform="rotate(-90 55 55)" style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 500, color: ringColor, lineHeight: 1 }}>{displayedPct}</div>
              <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>match</div>
            </div>
          </div>
        </div>

        {/* Matched on */}
        {person.matched?.length > 0 && (
          <div style={{ padding: '0 24px', animation: 'sc-fade-up 400ms ease-out 250ms both' }}>
            <div style={{ background: C.warmGrey, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
              <svg width="13" height="13" viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="10" cy="10" r="7" stroke={C.inkMuted} strokeWidth="1.6" />
                <path d="M15 15 L20 20" stroke={C.inkMuted} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <div>
                <span style={{ color: C.inkMuted, fontFamily: "'DM Sans', sans-serif" }}>Matched on: </span>
                {person.matched.map((kw, i) => {
                  const kc = kwColor(kw);
                  return (
                    <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.greenChipBg, color: C.greenText, padding: '2px 8px 2px 6px', borderRadius: 999, fontSize: 11, fontWeight: 500, marginRight: i < person.matched.length - 1 ? 4 : 0, fontFamily: "'DM Sans', sans-serif" }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.greenFill }} />{kw}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Why now */}
        <SectionLabel label="Why now" delay={350}>
          <div style={{ background: C.amberBg, borderLeft: '3px solid #E9A23B', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', color: C.amberText, textTransform: 'uppercase', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
              <span>⚡</span> Timing signal
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>{person.timingSignal}</div>
          </div>
        </SectionLabel>

        {/* Lead with */}
        <SectionLabel label="Lead with" rightLabel="Suggested opener" delay={450}>
          <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.07em', color: C.inkMuted, textTransform: 'uppercase', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Supercharged AI</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 15, lineHeight: 1.4, color: C.ink }}>{person.opener}</div>
          </div>
        </SectionLabel>

        {/* Compatibility breakdown */}
        <SectionLabel label="Compatibility breakdown" rightLabel="4 dimensions" delay={550}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DIM_ROWS.map((d, i) => (
              <DimBar key={d.key} label={d.label} desc={d.desc} score={Math.round(dims[d.key] || 0)} color={d.color} delay={600 + i * 100} />
            ))}
          </div>
        </SectionLabel>
      </div>

      {/* Pinned CTAs */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.paper, padding: '12px 20px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -12px 24px rgba(255,255,255,0.95)', flexShrink: 0, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setShowFullProfile(true)} style={{ width: '100%', height: 44, background: 'transparent', color: C.ink, border: `1.5px solid ${C.ink}`, borderRadius: 999, fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
          View their profile →
        </button>
        <button onClick={() => onConnect(person)} style={{ width: '100%', height: 52, background: C.ink, color: C.paper, border: 'none', borderRadius: 999, fontSize: 15, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
          Connect
        </button>
      </div>
      {showFullProfile && (
        <ProfileView
          profile={person}
          onClose={() => setShowFullProfile(false)}
          context="search"
        />
      )}
    </div>
  );
}

function SectionLabel({ label, rightLabel, delay, children }) {
  return (
    <div style={{ padding: '20px 24px 0', animation: `sc-fade-up 400ms ease-out ${delay}ms both` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', color: C.inkMuted, textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
        {rightLabel && <span style={{ fontSize: 11, fontWeight: 500, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" }}>{rightLabel}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main SearchScreen ────────────────────────────────────────────────────────
const SURFACED_TTL = 5 * 60 * 1000;

export default function SearchScreen({ profile, onClose, onConnect }) {
  const [view, setView] = useState('search'); // 'search' | 'results' | 'profile'
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('internal');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const inputRef = useRef(null);

  // Inject keyframes once
  useEffect(() => {
    if (!document.getElementById('search-screen-kf')) {
      const el = document.createElement('style');
      el.id = 'search-screen-kf';
      el.textContent = SEARCH_KEYFRAMES;
      document.head.appendChild(el);
    }
  }, []);

  // Focus input when search view mounts
  useEffect(() => {
    if (view === 'search') {
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [view]);

  const handleSubmit = async (q) => {
    setLoading(true);
    setResults([]);
    setView('results');

    try {
      if (scope === 'external') {
        const voltzRes = await functions.createExecution(
          CONNECTION_GATEWAY_FUNCTION_ID,
          JSON.stringify({ action: 'deduct_voltz', amount: 1, reason: 'External search' }),
          false
        );
        const voltzData = JSON.parse(voltzRes.responseBody);
        if (voltzData.error === 'insufficient_voltz') {
          alert('Insufficient Voltz for external search. Please top up.');
          setView('search');
          setLoading(false);
          return;
        }
      }

      const data = await callDiscovery({
        action: 'search',
        query: q,
        variant: scope === 'external' ? 'external' : 'hybrid_filtered',
        userId: profile?.$id,
      });

      const raw = data.results || data.matches || [];
      const enriched = raw.map((m, i) => enrichMatch({ ...m, is_external: m.is_on_app === false }, profile, i));
      setResults(enriched);
    } catch (e) {
      console.error('SearchScreen search error', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: C.warmGrey }}>
      {/* Search entry view */}
      {view === 'search' && (
        <SearchView
          onBack={onClose}
          query={query}
          setQuery={setQuery}
          scope={scope}
          setScope={setScope}
          onSubmit={handleSubmit}
          inputRef={inputRef}
        />
      )}

      {/* Results view */}
      {view === 'results' && (
        <ResultsView
          query={query}
          results={results}
          loading={loading}
          onClear={() => { setView('search'); setResults([]); setQuery(''); }}
          onBack={() => { setView('search'); setQuery(''); }}
          onOpenProfile={(person) => { setSelectedPerson(person); setView('profile'); }}
          onConnect={onConnect}
        />
      )}

      {/* Profile detail view */}
      {view === 'profile' && selectedPerson && (
        <ProfileDetailView
          person={selectedPerson}
          onBack={() => setView('results')}
          onConnect={onConnect}
        />
      )}
    </div>
  );
}
