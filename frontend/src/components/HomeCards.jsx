import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

export const compatColor = (score) => {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--dim-network)';
  return 'var(--text2)';
};

export const BoltIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

export const CardPhoto = ({ p, onCompatTap }) => (
  <div style={{ position: 'relative', width: '100%', height: '65%', overflow: 'hidden', flexShrink: 0, background: p.color || p.accent }}>
    {(p.photo_url || p.photo) && (
      <img
        src={p.photo_url || p.photo}
        alt={p.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    )}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 100%)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(15,15,15,0.72) 100%)', pointerEvents: 'none' }} />
    {p.time && (
      <div style={{ position: 'absolute', top: 16, left: 16, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
        {p.time}
      </div>
    )}
    {p.badge && (
      <div style={{ position: 'absolute', top: 14, right: 14, background: 'var(--accent)', color: '#8B6800', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', borderRadius: 999, padding: '5px 12px' }}>
        {p.badge}
      </div>
    )}
    <div style={{ position: 'absolute', bottom: 16, left: 18, right: 60, color: '#fff' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{p.name}</div>
      <div style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 12.5, color: 'rgba(255,255,255,0.82)' }}>{p.role}</div>
    </div>
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={(e) => { e.stopPropagation(); onCompatTap(); }}
      style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: '5px 10px', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', backdropFilter: 'blur(4px)' }}
    >
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: compatColor(p.score || p.compat || 0), lineHeight: 1 }}>
        {p.score ?? p.compat ?? 0}%
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 9, color: 'var(--text2)', letterSpacing: '0.04em', marginTop: 1 }}>match</span>
    </motion.button>
  </div>
);

export const Chip = ({ chip, delay = 0 }) => {
  const dotColor = { mutual: 'var(--dim-intent)', shared: 'var(--dim-identity)', network: 'var(--dim-resonance)', timing: 'var(--dim-network)' }[chip.kind] || 'var(--text3)';
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-light)', borderRadius: 999, padding: '4px 10px', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: 'var(--text)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      {chip.label}
    </motion.div>
  );
};

export const CardButton = ({ variant, onClick, children }) => {
  const isPrimary = variant === 'primary';
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{ flex: 1, height: 52, borderRadius: 999, fontFamily: 'var(--font-sans)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPrimary ? 'var(--text)' : 'var(--bg)', border: isPrimary ? '1.5px solid var(--border)' : '1.5px solid var(--border-light)', color: isPrimary ? '#fff' : 'var(--text2)', fontWeight: isPrimary ? 600 : 500 }}
    >
      {children}
    </motion.button>
  );
};

export const NewConnectionCard = ({ p, onAccept, onDecline, onCompatTap }) => (
  <>
    <CardPhoto p={p} onCompatTap={onCompatTap} />
    <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
        style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10, color: 'var(--text2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        THEY WROTE
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}
        style={{ marginTop: 6, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 14, color: 'var(--text)', lineHeight: 1.55, flex: 1 }}>
        "{p.message}"
      </motion.div>
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'nowrap', gap: 6, overflow: 'hidden' }}>
        {(p.compat_chips || p.chips || []).slice(0, 3).map((c, i) => (
          <Chip key={i} chip={c} delay={0.3 + i * 0.04} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <CardButton variant="secondary" onClick={onDecline}>Decline</CardButton>
        <CardButton variant="primary" onClick={onAccept}>Accept</CardButton>
      </div>
    </div>
  </>
);

export const SurfacedCard = ({ p, onSkip, onConnect, onCompatTap }) => {
  const pills = [
    p.primary_intent && { label: p.primary_intent, dot: 'var(--dim-intent)', border: 'rgba(61,170,130,0.3)', bg: 'rgba(61,170,130,0.08)' },
    p.college && { label: `${p.college} alumni`, dot: 'var(--dim-resonance)', border: 'rgba(155,124,246,0.3)', bg: 'rgba(155,124,246,0.08)' },
    p.year_of_study && { label: p.year_of_study, dot: '#F59E0B', border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.08)' },
    (p.career_field || p.study_subject) && { label: p.career_field || p.study_subject, dot: 'var(--text3)', border: 'rgba(175,175,175,0.3)', bg: 'rgba(175,175,175,0.08)' },
  ].filter(Boolean).slice(0, 4);

  return (
    <>
      <CardPhoto p={p} onCompatTap={onCompatTap} />
      <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
          style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10, color: 'var(--success)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
          <BoltIcon size={10} />
          WHY YOU'D WANT TO TALK
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          style={{ marginTop: 6, fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 18, color: 'var(--text)', lineHeight: 1.3, letterSpacing: '-0.01em', flex: 1,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.hook || p.building_description || p.match_reason || `${p.career_field || 'Building'} · ${p.college || 'Oxford'}`}
        </motion.div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pills.map((pill, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${pill.border}`, borderRadius: 999, padding: '4px 10px', background: pill.bg, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, color: pill.dot, whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: pill.dot, flexShrink: 0 }} />
              {String(pill.label).length > 20 ? String(pill.label).slice(0, 20) + '…' : pill.label}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <CardButton variant="secondary" onClick={onSkip}>Skip</CardButton>
          <CardButton variant="primary" onClick={onConnect}>Connect</CardButton>
        </div>
      </div>
    </>
  );
};

export const CardStack = ({ deck, tab, onAccept, onConnect, onCompatTap, onViewInbox }) => {
  const [index, setIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-3, 0, 3]);

  useEffect(() => { setIndex(0); }, [tab]);

  const advance = useCallback((dir) => {
    if (index + dir < 0 || index + dir >= deck.length) {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 32 });
      return;
    }
    setSwipeDir(dir);
    setIndex((i) => i + dir);
    x.set(0);
  }, [index, deck.length, x]);

  const handleDragEnd = (_, info) => {
    const direction = info.offset.x < 0 ? 1 : -1;
    const wouldBeOutOfBounds = index + direction < 0 || index + direction >= deck.length;

    if ((Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) && !wouldBeOutOfBounds) {
      advance(direction);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40, mass: 1 });
    }
  };

  if (!deck.length) return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onViewInbox}
      style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-sans)', fontSize: 14, cursor: onViewInbox ? 'pointer' : 'default', userSelect: 'none' }}>
      {tab === 'new' ? 'No new connection requests' : 'No surfaced connections right now'}
      {onViewInbox && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)' }}>Tap to view inbox →</div>}
    </motion.div>
  );

  const p = deck[index];
  const next = deck[index + 1];

  return (
    <div style={{ padding: '16px 20px 24px', position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%', height: 560 }}>
        {next && (
          <div style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 0, borderRadius: 20, background: 'var(--bg)', border: '1.5px solid var(--border-light)', transform: 'scale(0.96)', opacity: 0.6, pointerEvents: 'none', overflow: 'hidden' }}>
            <img src={next.photo_url || next.photo} alt="" style={{ width: '100%', height: '65%', objectFit: 'cover', objectPosition: 'center top', display: 'block', filter: 'blur(1px)' }} onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        )}
        <AnimatePresence custom={swipeDir} initial={false}>
          <motion.div
            key={`${tab}-${index}`}
            custom={swipeDir}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={handleDragEnd}
            style={{ x, rotate, touchAction: 'pan-y', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            initial={(d) => d === 0 ? { opacity: 0, scale: 0.98, x: 0 } : { x: d > 0 ? 360 : -360, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={(d) => ({ x: d > 0 ? -380 : 380, opacity: 0, rotate: d > 0 ? -6 : 6, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } })}
            transition={{ x: { type: 'spring', stiffness: 320, damping: 34 }, opacity: { duration: 0.25 }, scale: { duration: 0.3 } }}
          >
            <div style={{ width: '100%', height: 560, borderRadius: 20, overflow: 'hidden', background: 'var(--bg)', border: '1.5px solid var(--border)', display: 'flex', flexDirection: 'column', willChange: 'transform, opacity' }}>
              {tab === 'new' ? (
                <NewConnectionCard
                  p={p}
                  onAccept={() => onAccept(p)}
                  onDecline={() => advance(1)}
                  onCompatTap={() => onCompatTap(p, 'new')}
                />
              ) : (
                <SurfacedCard
                  p={p}
                  onSkip={() => advance(1)}
                  onConnect={() => onConnect(p)}
                  onCompatTap={() => onCompatTap(p, 'surfaced')}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        {deck.map((_, i) => (
          <motion.div key={i} animate={{ width: i === index ? 24 : 6, background: i === index ? 'var(--text)' : 'var(--border-light)' }} transition={{ duration: 0.25 }} style={{ height: 6, borderRadius: 999 }} />
        ))}
      </div>
    </div>
  );
};
