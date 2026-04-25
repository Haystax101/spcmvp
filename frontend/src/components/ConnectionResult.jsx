import React from 'react';
import { motion } from 'framer-motion';

export default function ConnectionResult({ person, type, onStartChatting, onBack }) {
  const isAccepted = type === 'accepted';
  const firstName = person?.name?.split(' ')[0] || 'them';

  const title = isAccepted ? 'Connection accepted' : 'Connection sent';
  const subtitle = isAccepted
    ? `You and ${firstName} are now connected. Say hello.`
    : `${firstName} will receive your request. You'll be notified when they respond.`;
  const ctaLabel = isAccepted ? 'Start chatting →' : 'Back to Home';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', borderRadius: 44, overflow: 'hidden' }}
    >
      {/* Top half — photo or coloured bg with initials */}
      <div style={{ flex: '0 0 58%', position: 'relative', background: person?.color || 'var(--dim-resonance)', overflow: 'hidden' }}>
        {(person?.photo_url || person?.photo) && (
          <img
            src={person.photo_url || person.photo}
            alt={person.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none' }} />
        {/* Large initials centred */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!(person?.photo_url || person?.photo) && (
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 72, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {person?.initials || '??'}
            </div>
          )}
        </div>
        {/* Accepted/Sent badge top-right */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.15, 1], opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, times: [0, 0.7, 1] }}
          style={{ position: 'absolute', top: 20, right: 20, width: 52, height: 52, borderRadius: '50%', background: isAccepted ? 'var(--success)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
        >
          {isAccepted ? (
            <motion.svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <motion.polyline points="20 6 9 17 4 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.45 }} />
            </motion.svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </motion.div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ flex: '0 0 48%', background: '#FFFEFD', borderRadius: 0, display: 'flex', flexDirection: 'column', padding: '28px 28px 36px' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 28, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}
        >
          {title}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.42 }}
          style={{ marginTop: 10, fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 15, color: 'var(--text2)', lineHeight: 1.5, flex: 1 }}
        >
          {subtitle}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <button
            onClick={isAccepted ? onStartChatting : onBack}
            style={{ width: '100%', height: 54, borderRadius: 999, background: 'var(--text)', color: '#fff', border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, cursor: 'pointer', letterSpacing: '-0.01em' }}
          >
            {ctaLabel}
          </button>
          {isAccepted && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 14, color: 'var(--text3)', cursor: 'pointer', padding: '4px 0' }}
            >
              Back to Home
            </button>
          )}
          {!isAccepted && (
            <button
              onClick={onStartChatting}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 14, color: 'var(--text3)', cursor: 'pointer', padding: '4px 0' }}
            >
              View in inbox
            </button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
