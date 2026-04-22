import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { functions, CONNECTION_GATEWAY_FUNCTION_ID } from '../lib/appwrite';

const COMPOSE_CSS = `
.csc-wrap { position:absolute; inset:0; display:flex; flex-direction:column; background:#FFFEFD; border-radius:44px; overflow:hidden; z-index:30; font-family:'DM Sans',sans-serif; }
.csc-header { padding:10px 20px; border-bottom:1px solid #DDDBD8; flex-shrink:0; }
.csc-header-row { display:flex; align-items:center; gap:12px; }
.csc-back-btn { background:none; border:none; font-size:26px; color:#1A1A1A; font-weight:400; padding:6px 10px 6px 0; margin-left:-4px; cursor:pointer; min-height:44px; display:flex; align-items:center; line-height:1; }
.csc-header-info { flex:1; display:flex; align-items:center; gap:10px; min-width:0; }
.csc-avatar { border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:600; flex-shrink:0; }
.csc-header-text { min-width:0; flex:1; }
.csc-name { font-weight:600; font-size:17px; color:#1A1A1A; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.csc-role { font-weight:400; font-size:12px; color:#AFAFAF; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.csc-banner { background:#FFFBF0; border-bottom:1px solid #F5E8C0; padding:10px 18px; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.csc-banner-text { font-family:'DM Sans',sans-serif; font-size:12px; font-weight:400; color:#A07800; line-height:1.4; }
.csc-thread { flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:10px; background:#FFFEFD; }
.csc-thread::-webkit-scrollbar { width:0; }
.csc-empty-hint { font-weight:400; font-size:13px; color:#AFAFAF; text-align:center; margin:auto; font-style:italic; }
.csc-msg-in { display:flex; gap:8px; align-items:flex-end; max-width:88%; }
.csc-bubble-in { background:#F0EDE8; border:none; border-radius:22px; padding:10px 14px; font-weight:400; font-size:14px; color:#1A1A1A; line-height:1.55; max-width:100%; }
.csc-bubble-out-wrap { align-self:flex-end; max-width:78%; display:flex; flex-direction:column; align-items:flex-end; }
.csc-bubble-out { background:#1A1A1A; border:none; border-radius:22px; padding:10px 14px; font-weight:400; font-size:14px; color:#FFFEFD; line-height:1.55; }
.csc-input-bar { border-top:1px solid #DDDBD8; padding:10px 16px 18px; display:flex; align-items:center; gap:10px; background:#FFFEFD; flex-shrink:0; }
.csc-ai-orb { width:36px; height:36px; border-radius:50%; border:1.5px solid #1A1A1A; background:#FFFEFD; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.csc-input-field { flex:1; border:1.5px solid #1A1A1A; border-radius:999px; background:#FFFEFD; padding:4px 4px 4px 16px; display:flex; align-items:center; gap:8px; min-height:40px; position:relative; }
.csc-input-field textarea { flex:1; border:none; outline:none; background:transparent; font-family:'DM Sans',sans-serif; font-weight:400; font-size:14px; color:#1A1A1A; padding:6px 0; min-width:0; resize:none; max-height:100px; overflow-y:auto; line-height:1.5; }
.csc-input-field textarea::placeholder { color:#AFAFAF; }
.csc-send-btn { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; flex-shrink:0; transition:all 0.15s ease; }
.csc-send-btn.active { background:#1A1A1A; }
.csc-send-btn.inactive { background:#F2F0EC; opacity:0.5; cursor:not-allowed; }
.csc-ai-sheet-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.3); z-index:50; }
.csc-ai-sheet { position:absolute; left:0; right:0; bottom:0; background:#FFFEFD; border-radius:22px 22px 0 0; padding:0 20px 32px; z-index:51; }
.csc-ai-sheet-handle { width:40px; height:4px; background:#DDDBD8; border-radius:999px; margin:14px auto 18px; }
.csc-ai-label { font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#AFAFAF; }
.csc-ai-draft-area { width:100%; border:none; border-bottom:1.5px solid #1A1A1A; background:transparent; font-family:'Playfair Display',serif; font-weight:300; font-size:17px; color:#1A1A1A; line-height:1.65; padding:12px 0; outline:none; resize:none; margin-top:8px; min-height:90px; }
.csc-ai-draft-hint { font-weight:400; font-size:12px; color:#AFAFAF; font-style:italic; margin-top:8px; }
.csc-btn-outline { width:100%; border:1.5px solid #1A1A1A; border-radius:999px; padding:14px; font-weight:600; font-size:14px; color:#1A1A1A; background:#FFFEFD; cursor:pointer; margin-top:16px; }
.csc-btn-filled { width:100%; background:#1A1A1A; border:none; border-radius:999px; padding:14px; font-weight:600; font-size:14px; color:#FFFEFD; cursor:pointer; margin-top:10px; }
`;

async function executeFunction(functionId, payload) {
  const exec = await functions.createExecution(functionId, JSON.stringify(payload), false);
  return JSON.parse(exec.responseBody);
}

export default function ComposeScreen({ person, onClose, onSend }) {
  const [text, setText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const textareaRef = useRef(null);
  const canSend = text.trim().length >= 10 && !drafting;

  useEffect(() => {
    const style = document.getElementById('csc-styles');
    if (!style) {
      const el = document.createElement('style');
      el.id = 'csc-styles';
      el.textContent = COMPOSE_CSS;
      document.head.appendChild(el);
    }
    return () => {};
  }, []);

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  };

  const handleDraftAI = async () => {
    if (!person) return;
    setDrafting(true);
    setAiOpen(true);
    setAiDraft('');
    try {
      const res = await executeFunction(CONNECTION_GATEWAY_FUNCTION_ID, {
        action: 'ai_draft_message',
        recipient_profile_id: person.$id || person.id || person.user_id,
      });
      if (res.error === 'insufficient_voltz') {
        alert('Not enough Voltz to draft with AI. Top up in your profile.');
        setAiOpen(false);
        return;
      }
      if (res.draft) {
        let i = 0;
        const type = () => {
          i++;
          setAiDraft(res.draft.slice(0, i));
          if (i < res.draft.length) setTimeout(type, 8);
        };
        type();
      }
    } catch {
      // silently ignore
    } finally {
      setDrafting(false);
    }
  };

  const handleUseDraft = () => {
    setText(aiDraft);
    setAiOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
  };

  const BoltIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );

  return (
    <motion.div
      className="csc-wrap"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="csc-header">
        <div className="csc-header-row">
          <button className="csc-back-btn" onClick={onClose}>‹</button>
          <div className="csc-header-info">
            <div
              className="csc-avatar"
              style={{ width: 40, height: 40, background: person?.color || 'var(--dim-resonance)', fontSize: 14, position: 'relative' }}
            >
              {(person?.photo_url || person?.photo) && (
                <img
                  src={person.photo_url || person.photo}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{person?.initials}</span>
            </div>
            <div className="csc-header-text">
              <div className="csc-name">{person?.name}</div>
              <div className="csc-role">{person?.role}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="csc-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A07800" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="csc-banner-text">Your message is your connection request — make it count</span>
      </div>

      {/* Thread */}
      <div className="csc-thread">
        {text.trim() ? (
          <div className="csc-bubble-out-wrap">
            <div className="csc-bubble-out">{text}</div>
          </div>
        ) : (
          <div className="csc-empty-hint">Write your opening message below</div>
        )}
      </div>

      {/* Input bar */}
      <div className="csc-input-bar">
        <button
          className="csc-ai-orb"
          onClick={handleDraftAI}
          disabled={drafting}
          title="Draft with AI (3 Voltz)"
          style={{ opacity: drafting ? 0.5 : 1 }}
        >
          {drafting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 14, height: 14, border: '1.5px solid #1A1A1A', borderTopColor: 'transparent', borderRadius: '50%' }}
            />
          ) : (
            <BoltIcon />
          )}
        </button>
        <div className="csc-input-field">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); autoResize(e); }}
            placeholder="Write your message..."
            disabled={drafting}
          />
          <button
            className={`csc-send-btn ${canSend ? 'active' : 'inactive'}`}
            onClick={handleSend}
            disabled={!canSend}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={canSend ? '#FFFEFD' : '#AFAFAF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI draft sheet */}
      {aiOpen && (
        <>
          <div className="csc-ai-sheet-overlay" onClick={() => setAiOpen(false)} />
          <div className="csc-ai-sheet">
            <div className="csc-ai-sheet-handle" />
            <div className="csc-ai-label">AI Draft · 3 Voltz</div>
            <textarea
              className="csc-ai-draft-area"
              value={aiDraft}
              onChange={(e) => setAiDraft(e.target.value)}
              placeholder={drafting ? 'Drafting…' : 'Your AI draft will appear here'}
              rows={4}
            />
            <div className="csc-ai-draft-hint">Edit before using. Tone and context are yours to own.</div>
            <button className="csc-btn-outline" onClick={() => setAiOpen(false)}>Dismiss</button>
            <button
              className="csc-btn-filled"
              onClick={handleUseDraft}
              disabled={!aiDraft || drafting}
              style={{ opacity: (!aiDraft || drafting) ? 0.4 : 1 }}
            >
              Use this draft
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
