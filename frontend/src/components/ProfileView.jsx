import React, { useState, useEffect } from 'react';
import { tables, functions, DB_ID, PROFILES_TABLE, CONNECTION_GATEWAY_FUNCTION_ID, Query } from '../lib/appwrite';
import { extractPhotoFileIds, buildPhotoUrl, PHOTO_SIZES } from '../lib/photos';

// ─── helpers ─────────────────────────────────────────────────────────────────

function safeParseJson(str, fallback = {}) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

function parseList(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function parseRow(row) {
  if (!row) return null;
  const freeText = safeParseJson(row.free_text_responses, {});
  const ui = (freeText.profile_ui && typeof freeText.profile_ui === 'object') ? freeText.profile_ui : {};

  const photoIds = extractPhotoFileIds(row);

  const music = parseList(ui.music ?? row.music);
  const hobbies = parseList(ui.hobbies ?? row.hobby);
  const campus = parseList(ui.campus ?? row.societies);
  const goals = parseList(ui.goals ?? row.goals);
  const datingAppearance = parseList(row.dating_appearance);
  const datingPersonality = parseList(row.dating_personality);
  const datingHobbies = parseList(row.dating_hobbies);

  return {
    fullName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.full_name || 'Oxford Member',
    college: row.college || '',
    subject: row.study_subject || row.course || '',
    year: row.year_of_study || row.stage || '',
    primaryIntent: row.primary_intent || '',
    relationshipStatus: row.relationship_status || '',
    sexuality: row.sexuality || '',
    datingAppearance,
    datingPersonality,
    datingHobbies,
    careerField: row.career_field || '',
    careerSubfield: row.career_subfield || '',
    projectStage: row.project_stage || '',
    networkingStyle: row.networking_style || '',
    workStyle: row.work_style || '',
    bio: ui.bio || row.building_description || '',
    honestThing: row.honest_thing || '',
    goals,
    music,
    hobbies,
    campus,
    photoIds,
  };
}

// Parse already-enriched profile (from search or home feed)
function parseEnriched(p) {
  const photoIds = extractPhotoFileIds(p);
  
  return {
    fullName: p.full_name || p.name || 'Oxford Member',
    college: p.college || '',
    subject: p.study_subject || p.course || '',
    year: p.year_of_study || p.year || '',
    primaryIntent: p.primary_intent || p.primaryIntent || '',
    relationshipStatus: p.relationship_status || p.relationshipStatus || '',
    sexuality: p.sexuality || '',
    datingAppearance: parseList(p.dating_appearance || p.datingAppearance),
    datingPersonality: parseList(p.dating_personality || p.datingPersonality),
    datingHobbies: parseList(p.dating_hobbies || p.datingHobbies),
    careerField: p.career_field || p.careerField || '',
    careerSubfield: p.career_subfield || p.careerSubfield || '',
    projectStage: p.project_stage || p.projectStage || '',
    networkingStyle: p.networking_style || p.networkingStyle || '',
    workStyle: p.work_style || p.workStyle || '',
    bio: p.building_description || p.bio || '',
    honestThing: p.honest_thing || '',
    goals: parseList(p.goals),
    music: parseList(p.music),
    hobbies: parseList(p.hobbies || p.hobby),
    campus: parseList(p.campus || p.societies),
    photoIds,
  };
}

const PALETTE = ['#7B5CF0', '#3DAA82', '#E8614A', '#3B82F6', '#F5A623'];
function paletteColor(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return PALETTE[h % PALETTE.length];
}

// ─── component ────────────────────────────────────────────────────────────────

/**
 * Unified ProfileView component for all contexts
 * @param {Object} props
 * @param {Object} props.profile - Raw profile data (enriched)
 * @param {string} props.profileId - Profile table row ID (for fetching)
 * @param {string} props.connectionId - Connection ID (for resolving profile)
 * @param {string} props.currentUserProfileId - Current user's profile ID
 * @param {Function} props.onClose - Callback when closing profile
 * @param {'own'|'inbox'|'chat'|'search'|'compatibility'} props.context - Display context (default: 'inbox')
 * @returns {React.ReactNode}
 */
export default function ProfileView({
  profile: rawProfile,
  profileId,
  connectionId,
  currentUserProfileId,
  onClose,
  context = 'inbox',
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    // Short-circuit if rawProfile has rich content
    if (rawProfile && (
      rawProfile.full_name || rawProfile.building_description || rawProfile.bio ||
      rawProfile.honest_thing || rawProfile.career_field ||
      (rawProfile.goals && (typeof rawProfile.goals === 'string' ? rawProfile.goals.trim() : rawProfile.goals.length > 0)) ||
      (extractPhotoFileIds(rawProfile).length > 0)
    )) {
      setData(parseEnriched(rawProfile));
      return;
    }

    // Otherwise fetch full profile
    const fetchProfile = async () => {
      setLoading(true);
      try {
        let targetProfileId = profileId;

        if (!targetProfileId && connectionId) {
          // Resolve from connection
          const exec = await functions.createExecution(
            CONNECTION_GATEWAY_FUNCTION_ID,
            JSON.stringify({ action: 'get_connection', connection_id: connectionId }),
            false
          );
          const res = safeParseJson(exec.responseBody, {});
          const conn = res.connection || {};
          targetProfileId = (conn.initiator_profile_id !== currentUserProfileId)
            ? conn.initiator_profile_id
            : conn.responder_profile_id;
        }

        if (!targetProfileId) {
          setData(rawProfile ? parseEnriched(rawProfile) : null);
          return;
        }

        const row = await tables.getRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: targetProfileId,
        }).catch(async () => {
          // Fallback: query by user_id
          const res = await tables.listRows({
            databaseId: DB_ID,
            tableId: PROFILES_TABLE,
            queries: [Query.equal('user_id', targetProfileId), Query.limit(1)],
          });
          return res.rows?.[0] || null;
        });
        setData(row ? parseRow(row) : (rawProfile ? parseEnriched(rawProfile) : null));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileId, connectionId]);

  if (loading || !data) {
    return (
      <div style={{ ...ROOT, ...contextStyles[context] }}>
        <button onClick={onClose} style={CLOSE_BTN}>‹</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B6B', fontSize: 14 }}>
          {loading ? 'Loading…' : 'Profile unavailable'}
        </div>
      </div>
    );
  }

  // Build photo URLs with context-aware sizing
  const photoSize = context === 'chat' ? PHOTO_SIZES.medium : PHOTO_SIZES.large;
  const photos = data.photoIds
    .map(fileId => buildPhotoUrl(fileId, photoSize))
    .filter(Boolean);
  
  const currentPhoto = photos[photoIdx] || null;
  const accent = paletteColor(data.fullName);
  const subLine = [data.college, data.subject, data.year].filter(Boolean).join('  ·  ');
  const initials = data.fullName.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  const isRomantic = String(data.primaryIntent || '').toLowerCase().includes('romantic') ||
    data.relationshipStatus || data.sexuality || data.datingAppearance.length ||
    data.datingPersonality.length || data.datingHobbies.length;
  const hereToPill = data.primaryIntent || data.relationshipStatus || data.careerField || 'Open to meeting people';
  const hereToPills = isRomantic
    ? [data.sexuality, data.relationshipStatus, ...data.datingAppearance.slice(0, 1), ...data.datingPersonality.slice(0, 1)].filter(Boolean)
    : [data.goals[0], data.goals[1]].filter(Boolean);

  return (
    <div style={{ ...ROOT, ...contextStyles[context] }}>
      {/* Hero Photo Section */}
      <div
        style={{
          position: 'relative',
          height: context === 'chat' ? 250 : 340,
          flexShrink: 0,
          background: currentPhoto ? '#111' : accent,
          overflow: 'hidden',
        }}
        onClick={() => photos.length > 1 && setPhotoIdx(i => (i + 1) % photos.length)}
      >
        {currentPhoto
          ? <img src={currentPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 300, color: 'rgba(255,255,255,0.7)', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{initials}</div>
        }
        {/* Scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(4,4,2,0.88) 0%, rgba(4,4,2,0.3) 45%, transparent 100%)', pointerEvents: 'none' }} />
        
        {/* Close button */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, left: 14, zIndex: 10, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFFEFD', fontSize: 22, lineHeight: 1 }}>
          ‹
        </button>
        
        {/* Photo carousel dots */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, padding: '0 24px' }}>
            {photos.map((_, i) => (
              <div key={i} style={{ height: 4, flex: 1, maxWidth: 80, borderRadius: 3, background: i === photoIdx ? 'rgba(255,254,253,0.92)' : 'rgba(255,254,253,0.35)' }} />
            ))}
          </div>
        )}
        
        {/* Name & college badge */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: context === 'chat' ? '0 16px 16px' : '0 22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300, fontSize: context === 'chat' ? 28 : 36, color: '#FFFEFD', lineHeight: 1, letterSpacing: '-0.5px' }}>{data.fullName}</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.65)', borderRadius: 999, padding: '4px 8px 4px 5px', flexShrink: 0 }}>
              <svg width="8" height="10" viewBox="0 0 8 11" fill="none"><polygon points="5,0 0,6 3.5,6 3,11 8,5 4.5,5" fill="#F5C842"/></svg>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#F5C842', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Oxford</span>
            </div>
          </div>
          {subLine && <div style={{ fontSize: 13, color: 'rgba(255,254,253,0.6)' }}>{subLine}</div>}
        </div>
      </div>

      {/* Content Sections */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#EDECEA', padding: context === 'chat' ? '8px 8px 32px' : '12px 12px 40px' }}>

        {/* Bio */}
        {data.bio && (
          <div style={CARD}>
            <div style={EY}>About</div>
            <div style={{ fontSize: 18, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.45, letterSpacing: '-0.2px' }}>{data.bio}</div>
          </div>
        )}

        {/* Here to / Intent */}
        {(data.primaryIntent || data.relationshipStatus || data.goals.length > 0 || data.careerField) && (
          <div style={CARD}>
            <div style={EY}>Here to</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>{hereToPill}</div>
            {hereToPills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {hereToPills.map((pill) => (
                  <span key={pill} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', background: 'rgba(0,0,0,0.06)', borderRadius: 999, padding: '5px 12px' }}>{pill}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dating / Romantic profile */}
        {(data.relationshipStatus || data.sexuality || data.datingAppearance.length > 0 || data.datingPersonality.length > 0 || data.datingHobbies.length > 0) && (
          <div style={CARD}>
            <div style={EY}>How you show up</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {data.relationshipStatus && <div style={{ fontSize: 15, color: '#1A1A1A' }}><strong>Relationship status:</strong> {data.relationshipStatus}</div>}
              {data.sexuality && <div style={{ fontSize: 15, color: '#1A1A1A' }}><strong>Sexuality:</strong> {data.sexuality}</div>}
              {data.datingAppearance.length > 0 && <div style={{ fontSize: 15, color: '#1A1A1A' }}><strong>Physically:</strong> {data.datingAppearance.join(', ')}</div>}
              {data.datingPersonality.length > 0 && <div style={{ fontSize: 15, color: '#1A1A1A' }}><strong>Personality:</strong> {data.datingPersonality.join(', ')}</div>}
              {data.datingHobbies.length > 0 && <div style={{ fontSize: 15, color: '#1A1A1A' }}><strong>Together:</strong> {data.datingHobbies.join(', ')}</div>}
            </div>
          </div>
        )}

        {/* Work / Career */}
        {(data.careerField || data.careerSubfield || data.projectStage || data.workStyle || data.networkingStyle) && (
          <div style={CARD}>
            <div style={EY}>Work</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>{data.careerField || 'Tap to add work details'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[data.careerSubfield, data.projectStage, data.workStyle, data.networkingStyle].filter(Boolean).map((pill) => (
                <span key={pill} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', background: '#F5F0E8', borderRadius: 999, padding: '5px 12px' }}>{pill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Music */}
        {data.music.length > 0 && (
          <div style={CARD}>
            <div style={EY}>Listening to</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {data.music.map(m => (
                <span key={m} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', background: '#F5F0E8', borderRadius: 999, padding: '5px 12px' }}>{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Hobbies */}
        {data.hobbies.length > 0 && (
          <div style={CARD}>
            <div style={EY}>Outside of work</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {data.hobbies.map(h => (
                <span key={h} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', background: '#FAF4E8', borderRadius: 999, padding: '5px 12px' }}>{h}</span>
              ))}
            </div>
          </div>
        )}

        {/* Campus */}
        {data.campus.length > 0 && (
          <div style={CARD}>
            <div style={EY}>On campus</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {data.campus.map(c => (
                <span key={c} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', background: '#F0F0E8', borderRadius: 999, padding: '5px 12px' }}>{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const ROOT = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#FFFEFD',
  zIndex: 200,
};

const contextStyles = {
  own: { position: 'fixed', inset: 0, zIndex: 100 },
  inbox: { position: 'fixed', inset: 0, zIndex: 150 },
  chat: { position: 'fixed', inset: 0, zIndex: 150, maxWidth: 500, margin: '0 auto' },
  search: { position: 'fixed', inset: 0, zIndex: 150 },
  compatibility: { position: 'fixed', inset: 0, zIndex: 150, maxWidth: 600, margin: '0 auto' },
};

const CLOSE_BTN = {
  position: 'absolute',
  top: 16,
  left: 14,
  zIndex: 10,
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.38)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#FFFEFD',
  fontSize: 22,
  lineHeight: 1,
};

const CARD = {
  background: '#FFFEFD',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  borderLeft: '3px solid rgba(0,0,0,0.04)',
};

const EY = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: '#AFAFAF',
  marginBottom: 12,
  fontFamily: "'DM Sans', sans-serif",
};
