import React, { useState, useEffect } from 'react';
import { tables, functions, storage, DB_ID, PROFILES_TABLE, PROFILE_PHOTOS_BUCKET_ID, CONNECTION_GATEWAY_FUNCTION_ID, Query } from '../lib/appwrite';

// ─── helpers ─────────────────────────────────────────────────────────────────

function safeParseJson(str, fallback = {}) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

function parseList(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function photoUrl(fileId) {
  if (!fileId) return null;
  try {
    return String(storage.getFilePreview({ bucketId: PROFILE_PHOTOS_BUCKET_ID, fileId, width: 750 }));
  } catch { return null; }
}

function parseRow(row) {
  if (!row) return null;
  const freeText = safeParseJson(row.free_text_responses, {});
  const ui = (freeText.profile_ui && typeof freeText.profile_ui === 'object') ? freeText.profile_ui : {};

  const photoIds = Array.isArray(ui.photo_file_ids) ? ui.photo_file_ids
    : Array.isArray(row.photo_file_ids) ? row.photo_file_ids : [];

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

// Parse already-enriched search match object (from enrichMatch in SearchScreen)
function parseEnriched(p) {
  // photo_file_ids may be top-level or nested in free_text_responses.profile_ui
  let photoIds = Array.isArray(p.photo_file_ids) ? p.photo_file_ids : [];
  if (photoIds.length === 0 && p.free_text_responses) {
    try {
      const ftr = typeof p.free_text_responses === 'string' ? JSON.parse(p.free_text_responses) : p.free_text_responses;
      const nested = ftr?.profile_ui?.photo_file_ids;
      if (Array.isArray(nested)) photoIds = nested;
    } catch {}
  }
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

const PALETTE = ['#7B5CF0','#3DAA82','#E8614A','#3B82F6','#F5A623'];
function paletteColor(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return PALETTE[h % PALETTE.length];
}

// ─── component ────────────────────────────────────────────────────────────────

export default function SharedProfileView({ profile: rawProfile, profileId, connectionId, currentUserProfileId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    // Only short-circuit if the profile has actual rich content (not just a display name)
    if (rawProfile && (rawProfile.full_name || rawProfile.building_description || rawProfile.bio ||
        rawProfile.honest_thing || rawProfile.career_field ||
        (rawProfile.goals && (typeof rawProfile.goals === 'string' ? rawProfile.goals.trim() : rawProfile.goals.length > 0)) ||
        (Array.isArray(rawProfile.photo_file_ids) && rawProfile.photo_file_ids.length > 0))) {
      setData(parseEnriched(rawProfile));
      return;
    }
    // Otherwise fetch
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
          // Fall back to basic display from rawProfile (thin object with name/role)
          setData(rawProfile ? parseEnriched(rawProfile) : null);
          return;
        }

        const row = await tables.getRow({ databaseId: DB_ID, tableId: PROFILES_TABLE, rowId: targetProfileId })
          .catch(async () => {
            // If direct get fails, try querying by user_id
            const res = await tables.listRows({ databaseId: DB_ID, tableId: PROFILES_TABLE, queries: [Query.equal('user_id', targetProfileId), Query.limit(1)] });
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
      <div style={ROOT}>
        <button onClick={onClose} style={CLOSE_BTN}>‹</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B6B', fontSize: 14 }}>
          {loading ? 'Loading…' : 'Profile unavailable'}
        </div>
      </div>
    );
  }

  const photos = data.photoIds.map(photoUrl).filter(Boolean);
  const currentPhoto = photos[photoIdx] || null;
  const accent = paletteColor(data.fullName);
  const subLine = [data.college, data.subject, data.year].filter(Boolean).join('  ·  ');
  const initials = data.fullName.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  const isRomantic = String(data.primaryIntent || '').toLowerCase().includes('romantic') || data.relationshipStatus || data.sexuality || data.datingAppearance.length || data.datingPersonality.length || data.datingHobbies.length;
  const hereToPill = data.primaryIntent || data.relationshipStatus || data.careerField || 'Open to meeting people';
  const hereToPills = isRomantic
    ? [data.sexuality, data.relationshipStatus, ...data.datingAppearance.slice(0, 1), ...data.datingPersonality.slice(0, 1)].filter(Boolean)
    : [data.goals[0], data.goals[1]].filter(Boolean);

  return (
    <div style={ROOT}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 340, flexShrink: 0, background: currentPhoto ? '#111' : accent, overflow: 'hidden' }}
        onClick={() => photos.length > 1 && setPhotoIdx(i => (i + 1) % photos.length)}>
        {currentPhoto
          ? <img src={currentPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 300, color: 'rgba(255,255,255,0.7)', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{initials}</div>
        }
        {/* Scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(4,4,2,0.88) 0%, rgba(4,4,2,0.3) 45%, transparent 100%)', pointerEvents: 'none' }} />
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, left: 14, zIndex: 10, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFFEFD', fontSize: 22, lineHeight: 1 }}>
          ‹
        </button>
        {/* Photo dots */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, padding: '0 24px' }}>
            {photos.map((_, i) => (
              <div key={i} style={{ height: 4, flex: 1, maxWidth: 80, borderRadius: 3, background: i === photoIdx ? 'rgba(255,254,253,0.92)' : 'rgba(255,254,253,0.35)' }} />
            ))}
          </div>
        )}
        {/* Name block */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300, fontSize: 36, color: '#FFFEFD', lineHeight: 1, letterSpacing: '-0.5px' }}>{data.fullName}</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.65)', borderRadius: 999, padding: '4px 8px 4px 5px', flexShrink: 0 }}>
              <svg width="8" height="10" viewBox="0 0 8 11" fill="none"><polygon points="5,0 0,6 3.5,6 3,11 8,5 4.5,5" fill="#F5C842"/></svg>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#F5C842', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Oxford</span>
            </div>
          </div>
          {subLine && <div style={{ fontSize: 13, color: 'rgba(255,254,253,0.6)' }}>{subLine}</div>}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#EDECEA', padding: '12px 12px 40px' }}>

        {/* Bio */}
        {data.bio && (
          <div style={CARD}>
            <div style={EY}>About</div>
            <div style={{ fontSize: 18, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.45, letterSpacing: '-0.2px' }}>{data.bio}</div>
          </div>
        )}

        {/* Here to */}
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

        {/* How you show up */}
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

        {/* Work */}
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

        {/* Societies */}
        {data.campus.length > 0 && (
          <div style={CARD}>
            <div style={EY}>On campus</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {data.campus.map(s => (
                <span key={s} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', background: '#EEF2FF', borderRadius: 999, padding: '5px 12px' }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Honest thing */}
        {data.honestThing && (
          <div style={{ ...CARD, borderLeft: '3px solid rgba(245,200,66,0.6)', paddingLeft: 14 }}>
            <div style={EY}>One honest thing</div>
            <div style={{ fontSize: 16, fontStyle: 'italic', color: '#333', lineHeight: 1.5 }}>"{data.honestThing}"</div>
          </div>
        )}
      </div>
    </div>
  );
}

const ROOT = { position: 'absolute', inset: 0, background: '#EDECEA', display: 'flex', flexDirection: 'column', zIndex: 300, fontFamily: "'DM Sans', system-ui, sans-serif" };
const CLOSE_BTN = { position: 'absolute', top: 16, left: 14, zIndex: 10 };
const CARD = { background: '#FFFEFD', borderRadius: 18, padding: '16px 18px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' };
const EY = { fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AFAFAF', marginBottom: 8 };
