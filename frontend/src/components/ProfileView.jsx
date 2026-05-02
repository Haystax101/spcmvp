import React, { useState, useEffect } from 'react';
import { tables, functions, DB_ID, PROFILES_TABLE, CONNECTION_GATEWAY_FUNCTION_ID, Query } from '../lib/appwrite';
import { extractPhotoFileIds, buildPhotoUrl, PHOTO_SIZES } from '../lib/photos';
import { track } from '../lib/tracking';

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

  const roles = (ui.roles && typeof ui.roles === 'object') ? ui.roles : {};

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
    roles,
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
    roles: p.roles || {},
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

const HOWUP_FIELDS = ['relationship_status','sexuality','dating_appearance','dating_personality','dating_hobbies'];
const HOWUP_MAP = {
  relationship_status: 'relationshipStatus',
  sexuality: 'sexuality',
  dating_appearance: 'datingAppearance',
  dating_personality: 'datingPersonality',
  dating_hobbies: 'datingHobbies',
};
const HOWUP_LABELS = {
  relationship_status: 'Relationship status',
  sexuality: 'Sexuality',
  dating_appearance: 'What you’re drawn to physically',
  dating_personality: 'What matters personality-wise',
  dating_hobbies: 'What you like doing together',
};

const hobbyColors = ['#FAC775','#EF9F27','#FAEEDA'];

function getHobbyIcon(name) {
  const n = name.toLowerCase();
  const p = (paths) => <svg viewBox="0 0 24 24" fill="none" stroke="#633806" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html: paths}}/>;

  if (n.includes('tennis')||n.includes('badminton')||n.includes('squash')||n.includes('table tennis')||n.includes('ping'))
    return p('<circle cx="11" cy="11" r="8"/><path d="M16 16l4 4"/><path d="M8 11h6M11 8v6"/>');
  if (n.includes('basketball'))
    return p('<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93c4.08 4.08 6.15 9.51 6.07 15.07M19.07 4.93c-4.08 4.08-6.15 9.51-6.07 15.07M2 12h20"/>');
  if (n.includes('football')||n.includes('soccer')||n.includes('rugby')||n.includes('american'))
    return p('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/>');
  if (n.includes('cricket'))
    return p('<path d="M4 20l12-12M7 7l2 2M17 3l4 4-2 2-4-4z"/><circle cx="6" cy="18" r="2"/>');
  if (n.includes('hockey'))
    return p('<path d="M5 20c0-4 2-8 6-10l8-6"/><circle cx="5" cy="20" r="2"/>');
  if (n.includes('golf'))
    return p('<circle cx="12" cy="18" r="2"/><path d="M12 16V4l6 4"/>');
  if (n.includes('volleyball')||n.includes('netball'))
    return p('<circle cx="12" cy="12" r="10"/><path d="M12 2c0 10-6 16-10 10M12 2c0 10 6 16 10 10"/>');
  if (n.includes('frisbee')||n.includes('lacrosse'))
    return p('<ellipse cx="12" cy="12" rx="10" ry="4"/><path d="M2 12c0 4 4.5 8 10 8s10-4 10-8"/>');
  if (n.includes('gym')||n.includes('weightlifting')||n.includes('crossfit')||n.includes('weight'))
    return p('<path d="M6 4v16M18 4v16M6 12h12"/><circle cx="3" cy="8" r="2"/><circle cx="3" cy="16" r="2"/><circle cx="21" cy="8" r="2"/><circle cx="21" cy="16" r="2"/>');
  if (n.includes('boxing')||n.includes('martial')||n.includes('kickbox')||n.includes('judo')||n.includes('karate'))
    return p('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>');
  if (n.includes('running')||n.includes('jogging')||n.includes('parkrun')||n.includes('sprint'))
    return p('<circle cx="12" cy="4" r="2"/><path d="M14 12l2 4h4M10 12l-2 4H4M12 6l1 4-3 2"/>');
  if (n.includes('cycl')||n.includes('bike')||n.includes('biking'))
    return p('<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17l-3-7 3-2 3 2M15 6h2l2 5"/><circle cx="12" cy="5" r="1"/>');
  if (n.includes('hiking')||n.includes('trekking')||n.includes('walking'))
    return p('<path d="M3 17l4-8 4 5 3-3 4 6"/><path d="M3 20h18"/>');
  if (n.includes('climbing')||n.includes('bouldering'))
    return p('<path d="M12 22V12M12 12l-4-4M12 12l4-4M5 22l7-10 7 10"/><circle cx="12" cy="5" r="2"/>');
  if (n.includes('ski')||n.includes('snowboard'))
    return p('<path d="M2 20l4-8 4 4 4-6 4 4 4-6"/><circle cx="6" cy="4" r="2"/>');
  if (n.includes('swim')||n.includes('open water'))
    return p('<path d="M2 12c1.5-3 3-4.5 4.5-4.5S9 9 10.5 9 13 7.5 14.5 7.5 17 9 18.5 9 21 7.5 22 7.5"/><path d="M2 16c1.5-3 3-4.5 4.5-4.5S9 13 10.5 13 13 11.5 14.5 11.5 17 13 18.5 13 21 11.5 22 11.5"/>');
  if (n.includes('surf')||n.includes('diving')||n.includes('scuba'))
    return p('<path d="M2 16c1.5-3 3-4.5 4.5-4.5S9 13 10.5 13 13 11.5 14.5 11.5 17 13 18.5 13 21 11.5 22 11.5"/><path d="M15 5l-3 6 5 1-8 7"/>');
  if (n.includes('sailing')||n.includes('rowing')||n.includes('kayak')||n.includes('canoe'))
    return p('<path d="M12 2v14M5 16h14"/><path d="M3 20h18M7 16c0-5 5-10 5-10s5 5 5 10"/>');
  if (n.includes('horse')||n.includes('equestrian')||n.includes('riding'))
    return p('<path d="M12 2c-1 0-3 1-3 3v2l-4 3v4h2l1-2h1l1 4h4l1-4h1l1 2h2v-4l-4-3V5c0-2-2-3-3-3z"/>');
  if (n.includes('yoga')||n.includes('pilates')||n.includes('meditation'))
    return p('<circle cx="12" cy="4" r="2"/><path d="M4 20c1-5 4-8 8-8s7 3 8 8"/><path d="M8 12c0 0 2 2 4 2s4-2 4-2"/>');
  if (n.includes('cooking')||n.includes('baking')||n.includes('dim sum')||n.includes('chef'))
    return p('<path d="M6 13.87A4 4 0 0 1 7.41 6a5 5 0 0 1 9.18 0A4 4 0 0 1 18 13.87V21H6z"/><line x1="6" y1="17" x2="18" y2="17"/>');
  if (n.includes('dining')||n.includes('food')||n.includes('brunch')||n.includes('restaurant'))
    return p('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>');
  if (n.includes('coffee'))
    return p('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>');
  if (n.includes('wine')||n.includes('cocktail')||n.includes('whisky')||n.includes('beer')||n.includes('drink'))
    return p('<path d="M8 22h8M7 10h10l-1 8H8z"/><path d="M7 10L5 3h14l-2 7"/>');
  if (n.includes('tea'))
    return p('<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>');
  if (n.includes('reading')||n.includes('book'))
    return p('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>');
  if (n.includes('writing')||n.includes('blogging')||n.includes('journal')||n.includes('poet')||n.includes('script'))
    return p('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>');
  if (n.includes('film')||n.includes('cinema')||n.includes('movie'))
    return p('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>');
  if (n.includes('theatre')||n.includes('theater')||n.includes('drama')||n.includes('improv'))
    return p('<path d="M2 10s3-3 6-3 6 3 6 3M14 17s-3 3-6 3-6-3-6-3"/>');
  if (n.includes('dance')||n.includes('ballet')||n.includes('salsa'))
    return p('<circle cx="12" cy="4" r="2"/><path d="M9 20l1-6 2 3 2-3 1 6"/><path d="M6 9h12"/>');
  if (n.includes('art')||n.includes('drawing')||n.includes('painting')||n.includes('pottery')||n.includes('sculpture'))
    return p('<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>');
  if (n.includes('photo'))
    return p('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
  if (n.includes('gaming')||n.includes('game')||n.includes('esport'))
    return p('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 12h2M18 12h2"/>');
  if (n.includes('chess')||n.includes('board game')||n.includes('card game'))
    return p('<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M8 10V7h2M8 10h3M10 10v5M15 7v8"/>');
  if (n.includes('crossword')||n.includes('puzzle'))
    return p('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>');
  if (n.includes('coding')||n.includes('program')||n.includes('tech')||n.includes('electronic'))
    return p('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>');
  return p('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>');
}

const toHumanLabel = (value) => {
  if (!value) return '';
  const str = String(value);
  if (str.toUpperCase() === str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
};

const PROFILE_VIEW_CSS = `
.p-card{border-radius:18px;overflow:hidden;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,0.05);background:#FFFEFD}
.p-header{display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;user-select:none;background:#FFFEFD;border-bottom:0.5px solid transparent}
.p-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.p-ico svg{width:17px;height:17px;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.p-txt{flex:1;min-width:0}
.p-label{font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;margin-bottom:4px}
.p-preview-name{font-size:15px;font-weight:500;line-height:1;margin-bottom:2px}
.p-preview-rest{font-size:11px;font-weight:400;opacity:0.65}
.p-chev{flex-shrink:0;transition:transform 0.25s ease;opacity:0.5}
.p-chev.open{transform:rotate(180deg)}
.p-body{max-height:0;overflow:hidden;transition:max-height 0.36s cubic-bezier(0.4,0,0.2,1);background:#FFFEFD}
.p-body.open{max-height:800px}
.pc-romantic{background:#FEF0F4}
.pc-romantic .p-ico{background:#F9C0D0}
.pc-romantic .p-ico svg{stroke:#8C1A3A}
.pc-romantic .p-label{color:#B02350}
.pc-romantic .p-preview-name{color:#8C1A3A}
.pc-romantic .p-preview-rest{color:#B02350}
.pc-romantic .p-chev svg{stroke:#B02350}
.pc-romantic .p-header{background:#FEF0F4}
.pc-romantic .p-body{background:#FEF0F4}
.howup-expanded{padding:0 16px 16px}
.howup-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}
.howup-row{display:flex;flex-direction:column;gap:3px}
.howup-label{font-size:9px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#B02350;opacity:0.7}
.howup-val{font-size:13px;font-weight:500;color:#8C1A3A}

.pc-music{background:#E1F5EE}.pc-music .p-ico{background:#9FE1CB}.pc-music .p-ico svg{stroke:#085041}.pc-music .p-label{color:#0F6E56}.pc-music .p-preview-name{color:#085041}.pc-music .p-preview-rest{color:#0F6E56}.pc-music .p-chev svg{stroke:#0F6E56}
.pc-music .p-header{background:#E1F5EE}
.pc-music .p-body{background:#E1F5EE}
.music-expanded{padding:0 16px 16px}
.music-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.music-tag-primary{background:#9FE1CB;color:#085041;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600}
.music-tag-secondary{background:rgba(31,158,117,0.1);border:1px solid rgba(31,158,117,0.22);color:#0F6E56;border-radius:999px;padding:5px 11px;font-size:12px}

.soc-name{font-size:14px;font-weight:500;color:#1A1A1A;line-height:1.2}
.soc-role{font-size:11px;font-weight:500;color:#534AB7;margin-top:2px;opacity:0.8}
.pc-hobbies{background:#FAEEDA}.pc-hobbies .p-ico{background:#FAC775}.pc-hobbies .p-ico svg{stroke:#633806}.pc-hobbies .p-label{color:#854F0B}.pc-hobbies .p-preview-name{color:#633806}.pc-hobbies .p-preview-rest{color:#854F0B}.pc-hobbies .p-chev svg{stroke:#854F0B}
.pc-hobbies .p-header{background:#FAEEDA}
.pc-hobbies .p-body{background:#FAEEDA}
.hobbies-expanded{padding:0 16px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.hobby-item{background:rgba(255,254,253,0.55);border-radius:13px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:5px}
.hobby-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center}
.hobby-icon svg{width:14px;height:14px;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.hobby-name{font-size:11px;font-weight:600;color:#633806;text-align:center}

.pc-socs{background:#EEEDFE}.pc-socs .p-ico{background:#CECBF6}.pc-socs .p-ico svg{stroke:#26215C}.pc-socs .p-label{color:#534AB7}.pc-socs .p-preview-name{color:#3C3489}.pc-socs .p-preview-rest{color:#534AB7}.pc-socs .p-chev svg{stroke:#534AB7}
.pc-socs .p-header{background:#EEEDFE}
.pc-socs .p-body{background:#EEEDFE}
.socs-expanded{padding:0 16px 14px}
.soc-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:0.5px solid rgba(83,74,183,0.14)}
.soc-item:last-child{border-bottom:none;padding-bottom:0}
.soc-dot{width:6px;height:6px;border-radius:50%;background:#534AB7;margin-top:5px;flex-shrink:0}
.soc-name{font-size:13px;font-weight:500;color:#3C3489;margin-bottom:2px}
.soc-badge{display:inline-block;font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;margin-top:3px}
.soc-badge-committee{background:#CECBF6;color:#26215C}
.soc-badge-member{background:rgba(83,74,183,0.1);color:#534AB7}

.bio-card{background:#FFFEFD;border-radius:18px;padding:18px 19px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.07)}
.bio-ey{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#AFAFAF;margin-bottom:10px}
.bio-lead{font-size:19px;font-weight:400;color:#1A1A1A;line-height:1.45;letter-spacing:-0.2px}

.intent-card{background:#FFFEFD;border-radius:18px;padding:18px 20px;margin-bottom:10px;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.07)}
.intent-card::after{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#F5C842}
.i-ey{font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#AFAFAF;margin-bottom:8px}
.i-hl{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.i-dot{width:8px;height:8px;border-radius:50%;background:#E8A020}
.i-lbl{font-size:26px;font-weight:500;color:#1A1A1A;letter-spacing:-0.4px}
.i-pills{display:flex;flex-wrap:wrap;gap:6px}
.ip-p{background:#1A1A1A;color:#FFFEFD;border-radius:999px;padding:7px 16px;font-size:13px;font-weight:600}
.ip-s{background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.1);color:#6B6B6B;border-radius:999px;padding:6px 13px;font-size:12px}

.slp{font-size:13px;font-weight:600;color:#1A1A1A;margin-bottom:8px;padding:0 4px;margin-top:10px;}
`;

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

  // Accordion states
  const [romanticOpen, setRomanticOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [hobbiesOpen, setHobbiesOpen] = useState(false);
  const [socsOpen, setSocsOpen] = useState(false);

  useEffect(() => {
    // Only short-circuit if we have rich profile content (bio, goals, etc.)
    if (rawProfile && (
      rawProfile.building_description || rawProfile.bio ||
      rawProfile.honest_thing || rawProfile.career_field ||
      (rawProfile.goals && (typeof rawProfile.goals === 'string' ? rawProfile.goals.trim() : rawProfile.goals.length > 0)) ||
      (extractPhotoFileIds(rawProfile).length > 0)
    )) {
      setData(parseEnriched(rawProfile));
      track.profileViewed(profileId || connectionId, context);
      return;
    }

    // Otherwise fetch full profile
    const fetchProfile = async () => {
      setLoading(true);
      try {
        let targetProfileId = profileId || rawProfile?.$id || rawProfile?.user_id;

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
        track.profileViewed(profileId || connectionId, context);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileId, connectionId, currentUserProfileId]);

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
    !!(data.relationshipStatus || data.sexuality || data.datingAppearance.length ||
    data.datingPersonality.length || data.datingHobbies.length);
    
  const intentHeading = data.primaryIntent === 'romantic' ? 'Meet someone' : 'Build';
  
  const hereToPill = data.primaryIntent || data.relationshipStatus || data.careerField || 'Open to meeting people';
  
  const intentPrimaryPill = data.primaryIntent === 'romantic' ? (data.relationshipStatus || 'Single') : (data.goals[0] || 'Meaningful connections');
  const intentSecondaryPills = isRomantic
    ? [data.sexuality, ...data.datingAppearance.slice(0, 1), ...data.datingPersonality.slice(0, 1)].filter(Boolean)
    : data.goals.slice(1, 3);
    
  const visibleHowup = HOWUP_FIELDS.filter(f => {
    const val = data[HOWUP_MAP[f]];
    if (!val) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  return (
    <div style={{ ...ROOT, ...contextStyles[context] }}>
      <style>{PROFILE_VIEW_CSS}</style>
      
      {/* Scrollable Container */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#EDECEA', scrollbarWidth: 'none' }}>
        
        {/* Hero Photo Section */}
        <div
          style={{
            position: 'relative',
            height: context === 'chat' ? 250 : 480,
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, background: 'linear-gradient(to top, rgba(4,4,2,0.93) 0%, rgba(4,4,2,0.5) 40%, transparent 100%)', pointerEvents: 'none' }} />
          
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: context === 'chat' ? '0 16px 16px' : '0 22px 24px', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300, fontSize: context === 'chat' ? 28 : 38, color: '#FFFEFD', lineHeight: 1, letterSpacing: '-0.5px' }}>{data.fullName}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.65)', borderRadius: 999, padding: '4px 8px 4px 5px', flexShrink: 0 }}>
                <svg width="8" height="10" viewBox="0 0 8 11" fill="none"><polygon points="5,0 0,6 3.5,6 3,11 8,5 4.5,5" fill="#F5C842"/></svg>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#F5C842', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Oxford</span>
              </div>
            </div>
            {subLine && <div style={{ fontSize: 13, color: 'rgba(255,254,253,0.6)' }}>{subLine}</div>}
          </div>
        </div>

        {/* Content Sections */}
        <div style={{ padding: '12px 12px calc(110px + env(safe-area-inset-bottom, 0px))' }}>

          {/* Bio */}
        {data.bio && (
          <div className="bio-card">
            <div className="bio-ey">About</div>
            <div className="bio-lead">{data.bio}</div>
          </div>
        )}

        {/* Here to */}
        {(data.primaryIntent || data.relationshipStatus || data.goals.length > 0 || data.careerField) && (
          <div className="intent-card">
            <div className="i-ey">Here to</div>
            <div className="i-hl"><div className="i-dot"/><span className="i-lbl">{intentHeading}</span></div>
            <div className="i-pills">
              <span className="ip-p">{intentPrimaryPill}</span>
              {intentSecondaryPills.map((pill, idx) => (
                <span key={`${pill}-${idx}`} className="ip-s">{pill}</span>
              ))}
              {!intentSecondaryPills.length && data.careerField && (
                <span className="ip-s">{toHumanLabel(data.careerField)}</span>
              )}
            </div>
          </div>
        )}

        {/* About me label */}
        {((isRomantic && visibleHowup.length > 0) || data.music.length > 0 || data.hobbies.length > 0 || data.campus.length > 0 || data.careerField) && (
          <div className="slp">About</div>
        )}

        {/* Romantic / How you show up */}
        {isRomantic && visibleHowup.length > 0 && (
          <div className="p-card pc-romantic">
            <div className="p-header" onClick={() => setRomanticOpen(!romanticOpen)}>
              <div className="p-ico">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="p-txt">
                <div className="p-label">How you show up</div>
                {!romanticOpen && (
                  <>
                    <div className="p-preview-name">{Array.isArray(data[HOWUP_MAP[visibleHowup[0]]]) ? data[HOWUP_MAP[visibleHowup[0]]].join(', ') : data[HOWUP_MAP[visibleHowup[0]]]}</div>
                    <div className="p-preview-rest">{visibleHowup.slice(1, 4).map(f => {
                      const val = data[HOWUP_MAP[f]];
                      return Array.isArray(val) ? val.join(', ') : val;
                    }).filter(Boolean).join(' · ')}</div>
                  </>
                )}
              </div>
              <div className={`p-chev${romanticOpen?' open':''}`}>
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#B02350" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
              </div>
            </div>
            <div className={`p-body${romanticOpen?' open':''}`}>
              <div className="howup-expanded">
                <div className="howup-grid">
                  {visibleHowup.map((field) => (
                    <div key={field} className="howup-row">
                      <span className="howup-label">{HOWUP_LABELS[field]}</span>
                      <span className="howup-val">{Array.isArray(data[HOWUP_MAP[field]]) ? data[HOWUP_MAP[field]].join(', ') : data[HOWUP_MAP[field]]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Work / Career */}
        {(data.careerField || data.careerSubfield || data.projectStage || data.workStyle || data.networkingStyle) && (
          <div className="p-card" style={{ background: '#FEF3E2', border: '1px solid rgba(217,119,6,0.15)' }}>
            <div className="p-header" onClick={() => setWorkOpen(!workOpen)} style={{ background: '#FEF3E2' }}>
              <div className="p-ico" style={{ background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              </div>
              <div className="p-txt">
                <div className="p-label" style={{ color: '#92400E' }}>Work</div>
                {!workOpen && <>
                  <div className="p-preview-name" style={{ color: '#1A1A1A' }}>{data.careerField || 'Work details'}</div>
                  {(data.careerSubfield || data.projectStage) && <div className="p-preview-rest" style={{ color: '#92400E' }}>{[data.careerSubfield, data.projectStage].filter(Boolean).join(' · ')}</div>}
                </>}
              </div>
              <div className={`p-chev${workOpen?' open':''}`}>
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#854F0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
              </div>
            </div>
            <div className={`p-body${workOpen?' open':''}`} style={{ background: '#FEF3E2' }}>
              <div style={{ padding: '0 16px 16px', fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                {[data.workStyle, data.networkingStyle].filter(Boolean).join(' · ') || 'No further work details provided.'}
              </div>
            </div>
          </div>
        )}

        {/* Music */}
        {data.music.length > 0 && (
          <div className="p-card pc-music">
            <div className="p-header" onClick={() => setMusicOpen(o => !o)}>
              <div className="p-ico">
                <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div className="p-txt">
                <div className="p-label">Listening to</div>
                {!musicOpen && <>
                  <div className="p-preview-name">{data.music[0] || '—'}</div>
                  <div className="p-preview-rest">{data.music.slice(1).join(', ')}{data.music.length>1?' and more':''}</div>
                </>}
              </div>
              <div className={`p-chev${musicOpen?' open':''}`}>
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
              </div>
            </div>
            <div className={`p-body${musicOpen?' open':''}`}>
              <div className="music-expanded">
                <div className="music-tags">
                  {data.music.map((m,i) => (
                    <span key={m} className={i===0?'music-tag-primary':'music-tag-secondary'}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hobbies */}
        {data.hobbies.length > 0 && (
          <div className="p-card pc-hobbies">
            <div className="p-header" onClick={() => setHobbiesOpen(o => !o)}>
              <div className="p-ico">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <div className="p-txt">
                <div className="p-label">Outside of work</div>
                {!hobbiesOpen && <>
                  <div className="p-preview-name">{data.hobbies.slice(0,3).join(', ')}</div>
                  <div className="p-preview-rest">{data.hobbies.slice(3).join(', ')}</div>
                </>}
              </div>
              <div className={`p-chev${hobbiesOpen?' open':''}`}>
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#854F0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
              </div>
            </div>
            <div className={`p-body${hobbiesOpen?' open':''}`}>
              <div className="hobbies-expanded">
                {data.hobbies.map((h,i) => (
                  <div key={h} className="hobby-item">
                    <div className="hobby-icon" style={{background: hobbyColors[i%3]}}>{getHobbyIcon(h)}</div>
                    <div className="hobby-name">{h}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Societies card */}
        {data.campus.length > 0 && (
          <div className="p-card pc-socs">
            <div className="p-header" onClick={() => setSocsOpen(o => !o)}>
              <div className="p-ico">
                <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="p-txt">
                <div className="p-label">On campus</div>
                {!socsOpen && <>
                  <div className="p-preview-name">{data.campus[0] || '—'}</div>
                  <div className="p-preview-rest">{data.campus.slice(1).join(', ')}</div>
                </>}
              </div>
              <div className={`p-chev${socsOpen?' open':''}`}>
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
              </div>
            </div>
            <div className={`p-body${socsOpen?' open':''}`}>
              <div className="socs-expanded">
                {data.campus.map(soc => {
                  return (
                      <div key={soc} className="soc-item">
                        <div className="soc-dot"/>
                        <div>
                          <div className="soc-name">{soc}</div>
                          {data.roles && data.roles[soc] && (
                            <div className="soc-role">{data.roles[soc]}</div>
                          )}
                        </div>
                      </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  </div>
  );
}

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
