import { useState, useEffect, useRef, useCallback } from "react";
import {
  account,
  functions,
  tables,
  storage,
  DB_ID,
  PROFILES_TABLE,
  PROFILE_PHOTOS_BUCKET_ID,
  CONNECTION_GATEWAY_FUNCTION_ID,
  Query,
  ID,
  Permission,
  Role,
} from "./lib/appwrite";
import { readCacheEntry, removeCacheEntry, writeCacheEntry } from "./lib/cache";

// ─── CSS injected once ───────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
.sc-profile-root,.sc-profile-root *{box-sizing:border-box;margin:0;padding:0}
.sc-profile-root{height:100%;min-height:0;display:flex;flex-direction:column}
.outer{display:flex;flex:1;min-height:0;height:100%;padding:0;background:transparent}
.phone{flex:1;width:100%;height:100%;min-height:0;display:flex;flex-direction:column;background:#EDECEA;position:relative;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}
@media (min-width:1024px){.outer{padding:16px 24px}.phone{max-width:1100px;margin:0 auto;border-radius:24px;border:1px solid rgba(0,0,0,0.08);box-shadow:0 20px 60px rgba(0,0,0,0.08)}}
.sbar{background:#F2F2F7;border-bottom:0.5px solid #C8C8CC;padding:10px 14px 7px;flex-shrink:0;z-index:20}
.sbar-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
.sbar-time{font-size:14px;font-weight:600;color:#1A1A1A}
.url-row{background:#fff;border:0.5px solid #C8C8CC;border-radius:10px;padding:7px 12px;display:flex;align-items:center;gap:7px}
.url-text{font-size:12px;color:#1A1A1A;flex:1;text-align:center}
.scroller{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;position:relative;background:#EDECEA}
.scroller::-webkit-scrollbar{display:none}
.hero{position:relative;height:480px;overflow:hidden;flex-shrink:0;background:linear-gradient(145deg,#2a3a42,#1a2a32)}
.hero-img{width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block}
.dots-row{position:absolute;top:14px;left:0;right:0;display:flex;justify-content:center;gap:5px;z-index:4;padding:0 24px}
.dot{height:4px;border-radius:3px;flex:1;max-width:80px;background:rgba(255,254,253,0.35)}
.dot.on{background:rgba(255,254,253,0.92)}
.photo-pager{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:6;display:inline-flex;align-items:center;gap:8px;padding:5px 9px;border-radius:999px;background:rgba(7,7,6,0.42);border:1px solid rgba(255,254,253,0.24);backdrop-filter:blur(4px)}
.photo-pager-btn{width:22px;height:22px;border:none;background:transparent;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#FFFEFD;cursor:pointer;padding:0;outline:none}
.photo-pager-btn svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.photo-pager-btn:disabled{opacity:0.35;cursor:default}
.photo-pager-count{min-width:30px;text-align:center;font-size:11px;font-weight:600;color:rgba(255,254,253,0.92);letter-spacing:0.04em}
.scrim{position:absolute;bottom:0;left:0;right:0;height:280px;background:linear-gradient(to top,rgba(4,4,2,0.93) 0%,rgba(4,4,2,0.5) 40%,transparent 100%);z-index:3;pointer-events:none}
.hero-info{position:absolute;bottom:0;left:0;right:0;padding:0 22px 24px;z-index:4;pointer-events:none}
.name-row{display:flex;align-items:center;gap:9px;margin-bottom:6px;white-space:nowrap}
.pname{font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:38px;color:#FFFEFD;line-height:1;letter-spacing:-0.5px}
.oxbadge{display:inline-flex;align-items:center;gap:3px;background:rgba(245,200,66,0.18);border:1px solid rgba(245,200,66,0.65);border-radius:999px;padding:4px 8px 4px 5px;flex-shrink:0}
.oxlabel{font-size:9px;font-weight:600;color:#F5C842;letter-spacing:0.08em;text-transform:uppercase}
.psub{font-size:13px;color:rgba(255,254,253,0.6)}
.photo-edit-btn{position:absolute;top:16px;right:14px;z-index:10;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.38);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;padding:0;outline:none;-webkit-appearance:none}
.photo-edit-btn svg{width:14px;height:14px;stroke:#FFFEFD;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.upload-prompt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:2;cursor:pointer;pointer-events:auto}
.upload-prompt svg{width:32px;height:32px;stroke:rgba(255,254,253,0.5);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.upload-prompt span{font-size:13px;color:rgba(255,254,253,0.7);font-weight:500}
.content{padding:12px 12px calc(16px + env(safe-area-inset-bottom, 0px));background:#EDECEA}
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
.slp{font-size:13px;font-weight:600;color:#1A1A1A;margin-bottom:8px;padding:0 4px}
.p-card{border-radius:18px;overflow:hidden;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.p-header{display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;user-select:none}
.p-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.p-ico svg{width:17px;height:17px;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.p-txt{flex:1;min-width:0}
.p-label{font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;margin-bottom:4px}
.p-preview-name{font-size:15px;font-weight:500;line-height:1;margin-bottom:2px}
.p-preview-rest{font-size:11px;font-weight:400;opacity:0.65}
.p-chev{flex-shrink:0;transition:transform 0.25s ease;opacity:0.5}
.p-chev.open{transform:rotate(180deg)}
.p-body{max-height:0;overflow:hidden;transition:max-height 0.36s cubic-bezier(0.4,0,0.2,1)}
.p-body.open{max-height:400px}
.pc-music{background:#E1F5EE}.pc-music .p-ico{background:#9FE1CB}.pc-music .p-ico svg{stroke:#085041}.pc-music .p-label{color:#0F6E56}.pc-music .p-preview-name{color:#085041}.pc-music .p-preview-rest{color:#0F6E56}.pc-music .p-chev svg{stroke:#0F6E56}
.pc-hobbies{background:#FAEEDA}.pc-hobbies .p-ico{background:#FAC775}.pc-hobbies .p-ico svg{stroke:#633806}.pc-hobbies .p-label{color:#854F0B}.pc-hobbies .p-preview-name{color:#633806}.pc-hobbies .p-preview-rest{color:#854F0B}.pc-hobbies .p-chev svg{stroke:#854F0B}
.pc-socs{background:#EEEDFE}.pc-socs .p-ico{background:#CECBF6}.pc-socs .p-ico svg{stroke:#26215C}.pc-socs .p-label{color:#534AB7}.pc-socs .p-preview-name{color:#3C3489}.pc-socs .p-preview-rest{color:#534AB7}.pc-socs .p-chev svg{stroke:#534AB7}
.music-expanded{padding:0 16px 16px}
.music-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.music-tag-primary{background:#9FE1CB;color:#085041;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600}
.music-tag-secondary{background:rgba(31,158,117,0.1);border:1px solid rgba(31,158,117,0.22);color:#0F6E56;border-radius:999px;padding:5px 11px;font-size:12px}
.music-note{font-size:12px;color:#0F6E56;font-style:italic;line-height:1.5;opacity:0.85}
.hobbies-expanded{padding:0 16px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.hobby-item{background:rgba(255,254,253,0.55);border-radius:13px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:5px}
.hobby-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center}
.hobby-icon svg{width:14px;height:14px;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.hobby-name{font-size:11px;font-weight:600;color:#633806;text-align:center}
.hobby-detail{font-size:10px;color:#854F0B;text-align:center;opacity:0.7}
.socs-expanded{padding:0 16px 14px}
.soc-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:0.5px solid rgba(83,74,183,0.14)}
.soc-item:last-child{border-bottom:none;padding-bottom:0}
.soc-dot{width:6px;height:6px;border-radius:50%;background:#534AB7;margin-top:5px;flex-shrink:0}
.soc-name{font-size:13px;font-weight:500;color:#3C3489;margin-bottom:2px}
.soc-detail{font-size:11px;color:#534AB7;opacity:0.75}
.soc-badge{display:inline-block;font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;margin-top:3px}
.soc-badge-committee{background:#CECBF6;color:#26215C}
.soc-badge-member{background:rgba(83,74,183,0.1);color:#534AB7}
.sls{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#AFAFAF;margin-bottom:8px;padding:0 4px;margin-top:10px}
.stats-strip{background:#FFFEFD;border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.07);margin-bottom:8px}
.stat-row{display:flex;align-items:center;padding:14px 18px;border-bottom:0.5px solid #EDECEA;cursor:pointer}
.stat-row:last-child{border-bottom:none}
.stat-icon{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:14px}
.stat-icon svg{width:17px;height:17px;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.stat-text{flex:1;min-width:0}
.stat-num{font-size:20px;font-weight:600;color:#1A1A1A;letter-spacing:-0.5px;line-height:1}
.stat-num.y{color:#C49B0A}
.stat-desc{font-size:11px;color:#888;margin-top:2px}
.stat-growth{font-size:10px;font-weight:500;margin-top:2px}
.stat-caret{color:#C8C8CC;flex-shrink:0;margin-left:10px}
.sbot{background:#F2F2F7;border-top:0.5px solid #C8C8CC;padding:8px 4px 20px;display:flex;justify-content:space-around;align-items:center;flex-shrink:0;z-index:20}
.sbtn{width:44px;height:36px;display:flex;align-items:center;justify-content:center;color:#007AFF}
.sbtn.dim{color:#C8C8CC}
.conn-panel{position:absolute;inset:0;background:#EDECEA;z-index:50;transform:translateX(calc(100% + 28px));transition:transform 0.36s cubic-bezier(0.22,1,0.36,1);display:flex;flex-direction:column;pointer-events:none}
.conn-panel.open{transform:translateX(0);pointer-events:auto}
.conn-nav{background:#F2F2F7;border-bottom:0.5px solid #C8C8CC;padding:11px 16px 10px;display:flex;align-items:center;position:relative;flex-shrink:0;min-height:44px}
.conn-back{display:inline-flex;align-items:center;gap:5px;background:none;border:none;cursor:pointer;color:#007AFF;font-size:14px;font-family:'DM Sans',system-ui,sans-serif;padding:0}
.conn-nav-title{position:absolute;left:50%;transform:translateX(-50%);font-size:15px;font-weight:600;color:#1A1A1A;font-family:'DM Sans',system-ui,sans-serif;letter-spacing:-0.2px}
.conn-score-header{font-size:11px;color:#AFAFAF;padding:10px 16px 4px}
.conn-score-header span{font-weight:500;color:#888}
.conn-list{flex:1;overflow-y:auto;padding:0 12px calc(32px + env(safe-area-inset-bottom, 0px));scrollbar-width:none}
.conn-list::-webkit-scrollbar{display:none}
.conn-item{background:#FFFEFD;border-radius:16px;padding:13px 15px;margin-bottom:7px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.conn-av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;flex-shrink:0;color:#FFFEFD}
.conn-info{flex:1;min-width:0}
.conn-name{font-size:13px;font-weight:500;color:#1A1A1A;margin-bottom:2px}
.conn-meta{font-size:11px;color:#AFAFAF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.csb{font-size:12px;font-weight:600;flex-shrink:0;padding:4px 9px;border-radius:8px}
.score-high{background:#E1F5EE;color:#0F6E56}
.score-mid{background:#FAEEDA;color:#854F0B}
.score-low{background:#F1EFE8;color:#888780}
.lb-rank{font-size:16px;font-weight:700;color:#AFAFAF;width:24px;flex-shrink:0;text-align:center;font-family:'DM Sans',system-ui,sans-serif}
.edit-panel{position:absolute;inset:0;z-index:60;background:rgba(237,236,234,0.92);backdrop-filter:blur(32px) saturate(1.8);-webkit-backdrop-filter:blur(32px) saturate(1.8);transform:translateY(calc(100% + 28px));transition:transform 0.42s cubic-bezier(0.16,1,0.3,1);display:flex;flex-direction:column;overflow:hidden;pointer-events:none}
.edit-panel.open{transform:translateY(0);pointer-events:auto}
.edit-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 12px;background:rgba(255,254,253,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(0,0,0,0.1);flex-shrink:0;position:relative}
.edit-cancel{background:none;border:none;cursor:pointer;padding:0;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:400;color:#AFAFAF;-webkit-appearance:none}
.edit-cancel:hover{color:#6B6B6B}
.edit-title-text{position:absolute;left:50%;transform:translateX(-50%);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;color:#1A1A1A;letter-spacing:-0.2px}
.edit-save{background:#1A1A1A;color:#FFFEFD;border:none;border-radius:999px;padding:7px 18px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;-webkit-appearance:none;transition:opacity 0.15s ease}
.edit-save:hover{opacity:0.82}
.edit-body{flex:1;overflow-y:auto;scrollbar-width:none;padding:4px 0 calc(32px + env(safe-area-inset-bottom, 0px))}
.edit-body::-webkit-scrollbar{display:none}
.edit-photo-strip{margin:16px 16px 8px;display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.edit-photo-strip::-webkit-scrollbar{display:none}
.edit-photo-slot{flex-shrink:0;width:110px;height:146px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(145deg,#2a3a42,#1a2a32);border:0.5px solid rgba(255,255,255,0.18);box-shadow:0 2px 10px rgba(0,0,0,0.18);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer}
.slot-label{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:500;color:rgba(255,255,255,0.55);margin-top:6px;letter-spacing:0.04em}
.slot-icon{width:24px;height:24px;stroke:rgba(255,255,255,0.45);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.edit-photo-slot-actions{position:absolute;bottom:0;left:0;right:0;padding:0 6px 8px;display:flex;gap:4px;justify-content:center;background:linear-gradient(transparent,rgba(0,0,0,0.45))}
.edit-photo-slot-btn{background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.5);border-radius:999px;padding:3px 9px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:10px;font-weight:500;color:rgba(255,255,255,0.9);white-space:nowrap}
.edit-section{margin:6px 16px;border-radius:18px;background:#F8F7F5;border:0.5px solid rgba(0,0,0,0.07);box-shadow:0 1px 8px rgba(0,0,0,0.05);padding:16px 18px;overflow:visible}
.edit-section-label{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#AFAFAF;margin-bottom:12px;font-family:'DM Sans',sans-serif}
.edit-field{margin-bottom:20px}
.edit-field:last-child{margin-bottom:0}
.edit-label{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#AFAFAF;margin-bottom:5px;font-family:'DM Sans',sans-serif}
.edit-input{font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:22px;color:#1A1A1A;border:none;border-bottom:1.5px solid rgba(0,0,0,0.15);border-radius:0;background:#F8F7F5;width:100%;padding:6px 0 8px;outline:none;-webkit-text-fill-color:#1A1A1A}
.edit-input::placeholder{color:#AFAFAF;-webkit-text-fill-color:#AFAFAF}
.edit-input:focus{border-bottom-color:#1A1A1A}
.edit-textarea{font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:18px;color:#1A1A1A;line-height:1.55;border:none;border-bottom:1.5px solid rgba(0,0,0,0.15);border-radius:0;background:#F8F7F5;width:100%;padding:6px 0 8px;outline:none;resize:none;overflow:hidden;min-height:70px;-webkit-text-fill-color:#1A1A1A}
.edit-textarea:focus{border-bottom-color:#1A1A1A}
.edit-count{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:400;color:#AFAFAF;text-align:right;margin-top:6px}
.tag-chips-wrap{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px;justify-content:flex-start}
.tag-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 14px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s ease;background:rgba(255,254,253,0.9);border-width:1.5px;border-style:solid;width:auto;flex-shrink:0;white-space:nowrap}
.tag-chip.removing{opacity:0;transform:scale(0.92)}
.chip-x{font-size:13px;opacity:0;transition:opacity 0.12s,margin-left 0.12s,width 0.12s;background:none;border:none;cursor:pointer;color:inherit;padding:0;line-height:1;width:0;margin-left:0;overflow:hidden}
.tag-chip.edit-mode .chip-x{opacity:0.7;width:10px;margin-left:2px}
.tag-chip.music{border-color:#2D7A5F;color:#2D7A5F}
.tag-chip.hobbies{border-color:#A0600A;color:#A0600A}
.tag-chip.campus{border-color:#5B45A0;color:#5B45A0}
.add-wrap{position:relative;margin-top:10px}
.tag-add-input{border:none;border-bottom:1.5px solid rgba(0,0,0,0.15);background:#F8F7F5;width:100%;font-family:'DM Sans',sans-serif;font-size:14px;color:#1A1A1A;-webkit-text-fill-color:#1A1A1A;padding:8px 0;outline:none;border-radius:0}
.tag-add-input:focus{border-bottom-color:#1A1A1A}
.tag-add-input::placeholder{color:#AFAFAF;-webkit-text-fill-color:#AFAFAF}
.suggestion-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:rgba(255,254,253,0.98);border:1px solid rgba(0,0,0,0.08);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:9999;overflow:hidden;max-height:180px;overflow-y:auto}
.suggestion-item{padding:11px 16px;font-family:'DM Sans',sans-serif;font-size:14px;color:#1A1A1A;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,0.06)}
.suggestion-item:last-child{border-bottom:none}
.suggestion-item:hover{background:rgba(0,0,0,0.04)}
.suggestion-empty{padding:11px 16px;font-family:'DM Sans',sans-serif;font-size:13px;color:#AFAFAF;font-style:italic}
.growth-card{background:#FFFEFD;border-radius:18px;box-shadow:0 1px 4px rgba(0,0,0,0.07);margin-bottom:8px;overflow:hidden;padding:14px 16px 12px}
.growth-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.growth-title{font-size:13px;font-weight:600;color:#1A1A1A;letter-spacing:-0.1px;font-family:'DM Sans',system-ui,sans-serif}
.growth-period-row{display:flex;gap:2px}
.growth-period-btn{background:transparent;border:none;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:500;color:#AFAFAF;padding:3px 8px;border-radius:999px;cursor:pointer;transition:all 0.15s ease}
.growth-period-btn.active{background:#1A1A1A;color:#FFFEFD}
.growth-chart-wrap{border-radius:10px;overflow:hidden;margin-bottom:10px;background:#F8F7F5}
.growth-footer{display:flex;align-items:baseline;gap:8px}
.growth-num{font-size:22px;font-weight:700;color:#1A1A1A;letter-spacing:-0.5px;font-family:'DM Sans',system-ui,sans-serif}
.growth-change{font-size:12px;font-weight:500;color:#0F6E56;font-family:'DM Sans',system-ui,sans-serif}
`;

// ─── Data ────────────────────────────────────────────────────────────────────
const ARTISTS = ['The Weeknd','Drake','Taylor Swift','Bad Bunny','Kendrick Lamar','SZA','Doja Cat','Post Malone','Billie Eilish','Olivia Rodrigo','Harry Styles','Dua Lipa','Ed Sheeran','Ariana Grande','Travis Scott','Rihanna','Beyoncé','Kanye West','Jay-Z','Eminem','Lil Uzi Vert','21 Savage','Future','Playboi Carti','Metro Boomin','A$AP Rocky','Gunna','Lil Baby','Cardi B','Nicki Minaj','Ice Spice','Central Cee','Dave','Little Simz','Stormzy','AJ Tracey','Skepta','Headie One','Slowthai','Pa Salieu','Loyle Carner','Ghetts','Kano','Giggs','J Hus','Jorja Smith','Frank Ocean','Tyler the Creator','Childish Gambino','J Cole','Mac Miller','Bon Iver','Phoebe Bridgers','Mitski','Clairo','Daniel Caesar','Steve Lacy','Blood Orange','James Blake','FKA twigs','Solange','Lana Del Rey','Hozier','Rex Orange County','Tame Impala','Arctic Monkeys','Radiohead','The Strokes','Vampire Weekend','LCD Soundsystem','MGMT','Fleet Foxes','Sufjan Stevens','Angel Olsen','Big Thief','Adrianne Lenker','Julien Baker','Lucy Dacus','boygenius','Waxahatchee','Snail Mail','Soccer Mommy','Caroline Polachek','Charli XCX','Carly Rae Jepsen','Robyn','Christine and the Queens','Perfume Genius','Moses Sumney','Sampha','Arlo Parks','Beabadoobee','Declan McKenna','Easy Life','Sea Girls','Courting','Squid','Black Midi','Black Country New Road','Dry Cleaning','Shame','Idles','Fontaines DC','Inhaler','Dermot Kennedy','George Ezra','Sam Fender','Wet Leg','Self Esteem','Yard Act','Bicep','Fred again..','Four Tet','Jamie xx','Floating Points','Bonobo','Tom Misch','Jordan Rakei','Yussef Dayes','Ezra Collective','Nubya Garcia','Jon Hopkins','Nicolas Jaar','Caribou','Rival Consoles','Mount Kimbie','The xx','James Holden','Actress','Clark','Arca','Burial','Boards of Canada','Aphex Twin','Brian Eno','Nils Frahm','Olafur Arnalds','Max Richter','Johann Johannsson','Julianna Barwick','William Basinski','Grouper','Loscil','Stars of the Lid','Explosions in the Sky','Mogwai','Godspeed You! Black Emperor','Sigur Rós','Hammock','The Beatles','David Bowie','Led Zeppelin','Pink Floyd','Fleetwood Mac','Talking Heads','New Order','The Cure','Joy Division','Depeche Mode','Nirvana','Oasis','Blur','Pulp','The Smiths','Bob Dylan','Neil Young','Joni Mitchell','Nick Drake','Leonard Cohen','Nina Simone','Miles Davis','John Coltrane','Chet Baker','Bill Evans','Amy Winehouse','Frank Sinatra','Ella Fitzgerald','Billie Holiday','Burna Boy','Wizkid','Davido','Fireboy DML','Rema','Asake','Fela Kuti','Rosalía','J Balvin','Ozuna','Rauw Alejandro','Karol G','Stromae','Angèle','PNL','Nekfeu','Orelsan','SCH','Laylow','Hamza','Niro','Jul','Sofiane','Damso','Booba','Lacrim','Mac DeMarco','Alex G','Men I Trust','Dijon','Mk.gee','Omar Apollo','Giveon','Lucky Daye','BJ the Chicago Kid','Leon Bridges','Anderson .Paak','Thundercat','Hiatus Kaiyote','BROCKHAMPTON','Megan Thee Stallion','Doechii','GloRilla','Sexyy Red','Latto','Flo Milli','Yeat','Ken Carson','Destroy Lonely','Bladee','Ecco2k','Drain Gang','Thaiboy Digital'];
const INTERESTS = ['Football','Basketball','Tennis','Running','Hiking','Cycling','Swimming','Climbing','Yoga','Pilates','Cooking','Baking','Reading','Writing','Film','Photography','Travel','Chess','Gaming','Surfing','Skiing','Snowboarding','Boxing','Gym','Weightlifting','CrossFit','Art','Drawing','Painting','Pottery','Sculpture','Design','Theatre','Musical theatre','Dance','Ballet','Salsa','Volunteering','Podcasts','Crosswords','Meditation','Journaling','Gardening','Birdwatching','Fishing','Sailing','Horse riding','Rowing','Badminton','Squash','Table tennis','Martial arts','Kickboxing','Judo','Rock climbing','Skateboarding','Wakeboarding','Diving','Rugby','Cricket','Hockey','Golf','Frisbee','Volleyball','Netball','Lacrosse','American football','Esports','Board games','Card games','Coding','Electronics','3D printing','Astronomy','Knitting','Sewing','Calligraphy','Origami','Candle making','Cocktail making','Wine tasting','Coffee brewing','Record collecting','Songwriting','Music production','DJing','Film making','Screenwriting','Blogging','Stand-up comedy','Improv','Creative writing','Poetry','Dim sum','Street food','Fine dining','Brunch','Craft beer','Whisky tasting','Tea ceremony','Foraging','Wild swimming','Cold water dips','Parkrun','Marathon training','Triathlon','Open water swimming','Scuba diving'];
const SOCIETIES = ['Oxford Entrepreneurs','Oxford Union','Oxford Investment Society','Oxford Consulting Group','Oxford Philosophy Society','Oxford Debate Society','Oxford Drama Society','Oxford Music Society','Oxford Film Society','Oxford Geography Society','Oxford Economics Society','Oxford Law Society','Oxford Politics Society','Oxford History Society','Oxford English Society','Oxford Mathematics Society','Oxford Science Society','Oxford Engineering Society','Oxford Medical Society','Oxford Psychology Society','Oxford Sociology Society','Oxford Architecture Society','Oxford Art Society','Oxford Fashion Society','Oxford Photography Society','Oxford Creative Writing Society','Oxford Journalism Society','Oxford Marketing Society','Oxford Finance Society','Oxford Real Estate Society','Oxford Startup Society','Oxford Tech Society','Oxford AI Society','Oxford Robotics Society','Oxford Data Science Society','Oxford Blockchain Society','Oxford Sustainability Society','Oxford Climate Society','Oxford Feminist Society','Oxford LGBTQ+ Society','Oxford International Society','Oxford African Society','Oxford Asian Society','Oxford South Asian Society','Oxford East Asian Society','Oxford Latin American Society','Oxford Middle East Society','Oxford Jewish Society','Oxford Islamic Society','Oxford Christian Union','Oxford Buddhist Society','Oxford Hindu Society','Oxford Sikh Society','Oxford Interfaith Society','Oxford Volunteer Society','Oxford RAG','Oxford Athletics Club','Oxford Swimming Club','Oxford Basketball Club','Oxford Badminton Club','Oxford Squash Club','Oxford Climbing Club','Oxford Cycling Club','Oxford Skiing Club','Oxford Rowing Club','Oxford Rugby Club','Oxford Football Club','Oxford Cricket Club','Oxford Tennis Club','Oxford Hockey Club','Oxford Fencing Club','Oxford Judo Club','Oxford Boxing Club','Oxford Dance Society','Oxford Ballet Society','Oxford Salsa Society','Oxford Choir','Oxford Orchestra','Oxford Jazz Band','Oxford A Cappella','Oxford Opera Society','Oxford Chamber Music','Cambridge Entrepreneurs','Cambridge Union','Cambridge Investment Club','LSE Consulting Society','LSE Entrepreneurs','LSE Investment Society','LSE Africa Society','LSE SU','Imperial Entrepreneurs','Imperial Robotics','UCL Entrepreneurs','UCL Investment Club','Kings Entrepreneurs','Student newspaper','Student radio','Student TV','Hackathon society','Charity committee','Environment society','Model United Nations'];
const SUGG = { music: ARTISTS, hobbies: INTERESTS, socs: SOCIETIES };

const CHART_DATA = {
  conn: {
    '1w': { pts:[28,28,29,29,30,31,31], num:'31', change:'+4 this week', changeColor:'#0F6E56' },
    '1m': { pts:[18,20,22,23,25,27,29,31], num:'31', change:'+13 this month', changeColor:'#0F6E56' },
    '3m': { pts:[5,9,13,16,20,24,28,31], num:'31', change:'+26 this quarter', changeColor:'#0F6E56' },
  },
  voltz: {
    '1w': { pts:[1380,1400,1440,1490,1530,1580,1620], num:'1,620', change:'+220 this week', changeColor:'#BA7517' },
    '1m': { pts:[800,950,1050,1150,1280,1420,1530,1620], num:'1,620', change:'+820 this month', changeColor:'#BA7517' },
    '3m': { pts:[120,300,500,750,1000,1280,1500,1620], num:'1,620', change:'+1,500 this quarter', changeColor:'#BA7517' },
  },
};

const CONNECTIONS = [
  { group:'Connected this month', items:[
    { initials:'PC', colour:'#7F77DD', name:'Pui Cheung', meta:'Co-founder, Supercharged · LSE', score:'98%', scoreClass:'score-high' },
    { initials:'GH', colour:'#1D9E75', name:'George Hastings', meta:'Co-founder, Supercharged · Bath', score:'95%', scoreClass:'score-high' },
    { initials:'SA', colour:'#D85A30', name:'Sofia Andersen', meta:'Founder, Kinetic Labs · Oxford', score:'83%', scoreClass:'score-high' },
  ]},
  { group:'Connected last month', items:[
    { initials:'JL', colour:'#378ADD', name:'James Liu', meta:'Associate, Sequoia Capital', score:'79%', scoreClass:'score-mid' },
    { initials:'AO', colour:'#D4537E', name:'Amara Osei', meta:'PM, Monzo · Oxford grad', score:'76%', scoreClass:'score-mid' },
    { initials:'TW', colour:'#BA7517', name:'Tom Whitfield', meta:'IBD Analyst · Goldman Sachs', score:'71%', scoreClass:'score-mid' },
  ]},
  { group:'Earlier', items:[
    { initials:'NP', colour:'#534AB7', name:'Nadia Petrov', meta:'Research, DeepMind · Oxford', score:'68%', scoreClass:'score-low' },
    { initials:'RK', colour:'#5F5E5A', name:'Rishi Kapoor', meta:'Consultant, McKinsey London', score:'63%', scoreClass:'score-low' },
  ]},
];

const LEADERBOARD = [
  { rank:1, initials:'PC', colour:'#7F77DD', name:'Pui Cheung', meta:'LSE · Supercharged', voltz:'1,620', gold:true,
    profile:{ name:'Pui Cheung', initials:'PC', colour:'#7F77DD', meta:'Co-founder, Supercharged · LSE', score:'98%', scoreClass:'score-high' }},
  { rank:2, initials:'GH', colour:'#1D9E75', name:'George Hastings', meta:'Bath · Supercharged', voltz:'1,580' },
  { rank:3, initials:'SA', colour:'#D85A30', name:'Sofia Andersen', meta:'Oxford · Kinetic Labs', voltz:'1,420' },
  { rank:4, initials:'JL', colour:'#378ADD', name:'James Liu', meta:'Sequoia Capital', voltz:'1,310' },
  { rank:5, initials:'AO', colour:'#D4537E', name:'Amara Osei', meta:'Monzo · Oxford', voltz:'1,190' },
  { rank:6, initials:'TW', colour:'#BA7517', name:'Tom Whitfield', meta:'Goldman Sachs', voltz:'1,050' },
  { rank:7, initials:'NP', colour:'#534AB7', name:'Nadia Petrov', meta:'DeepMind · Oxford', voltz:'890' },
  { rank:8, initials:'RK', colour:'#5F5E5A', name:'Rishi Kapoor', meta:'McKinsey London', voltz:'740' },
];

// ─── Hobby icon ──────────────────────────────────────────────────────────────
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
  if (n.includes('music')||n.includes('song')||n.includes('dj')||n.includes('produc')||n.includes('record'))
    return p('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>');
  if (n.includes('sing')||n.includes('choir')||n.includes('vocal')||n.includes('opera'))
    return p('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>');
  if (n.includes('guitar')||n.includes('piano')||n.includes('cello')||n.includes('violin')||n.includes('drum'))
    return p('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>');
  if (n.includes('podcast')||n.includes('radio'))
    return p('<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 19.07a10 10 0 0 1 0-14.14"/>');
  if (n.includes('travel')||n.includes('adventure'))
    return p('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>');
  if (n.includes('garden')||n.includes('plant')||n.includes('forag'))
    return p('<path d="M12 22V12M12 12C12 12 7 9 5 4c3.5 1 6.5 3.5 7 8z"/><path d="M12 12c0 0 5-3 7-8-3.5 1-6.5 3.5-7 8z"/>');
  if (n.includes('bird'))
    return p('<path d="M16 7s-2-2-4-2c-4 0-8 4-8 8s2 4 4 4h2"/><path d="M22 10c-2.5 0-5 2-5 4h-3"/>');
  if (n.includes('fishing'))
    return p('<path d="M18 2l-4 6M18 2l4 6M2 16s0-8 8-8 8 8 8 8"/>');
  if (n.includes('knit')||n.includes('sewing')||n.includes('calligraph'))
    return p('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>');
  if (n.includes('volunteer')||n.includes('charity'))
    return p('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>');
  if (n.includes('astronom')||n.includes('stargaz'))
    return p('<circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>');
  if (n.includes('skate')||n.includes('parkour'))
    return p('<path d="M5 20h14M7 20l2-6h6l2 6M12 14V4"/>');
  if (n.includes('marathon')||n.includes('triathlon'))
    return p('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>');
  // default — person running
  return p('<circle cx="12" cy="4" r="2"/><path d="M14 12l2 5h-3l-1-3-2 3H7l2-5 3-3z"/><path d="M9 9l-2 3M15 9l2 3"/>');
}

// ─── Chart rendering ─────────────────────────────────────────────────────────
function renderChartSVG(stat, period) {
  const d = CHART_DATA[stat][period];
  const pts = d.pts;
  const W=300, H=80, pad=4;
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const coords = pts.map((v,i) => {
    const x = pad + (i/(pts.length-1))*(W-pad*2);
    const y = (H-pad) - ((v-min)/range)*(H-pad*2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lineColor = stat==='conn' ? '#1A9E75' : '#E8A020';
  const fillColor = stat==='conn' ? 'rgba(26,158,117,0.08)' : 'rgba(232,160,32,0.10)';
  const polyPts = coords.join(' ');
  const firstPt = coords[0].split(',');
  const lastPt = coords[coords.length-1].split(',');
  const fillPts = `${polyPts} ${lastPt[0]},${H+2} ${firstPt[0]},${H+2}`;
  return { fillPts, polyPts, lineColor, fillColor, num: d.num, change: d.change, changeColor: d.changeColor };
}

const DEFAULT_PROFILE_STATE = {
  firstName: '',
  lastName: '',
  college: '',
  subject: '',
  year: '',
  bio: '',
  music: [],
  hobbies: [],
  campus: [],
  primaryIntent: '',
  goals: [],
  desiredConnections: [],
  projectStage: '',
  careerField: '',
  roles: {},
};

const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;
const PROFILE_CACHE_KEY = (userId) => `supercharged:profile:v1:${userId}`;
const DEFAULT_STATS = {
  connectionsCount: 0,
  connectionsGrowth: 0,
  voltzBalance: 0,
  voltzGrowth: 0,
};

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const toHumanLabel = (value) => {
  const text = normalizeString(value);
  if (!text) return '';
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

const deriveIntentHeading = (profileState) => {
  const intent = normalizeString(profileState?.primaryIntent).toLowerCase();
  if (intent === 'professional') return 'Build';
  if (intent === 'social') return 'Connect';
  if (intent === 'academic') return 'Study';
  if (intent === 'romantic') return 'Date';
  if (intent) return toHumanLabel(intent);
  return profileState?.goals?.[0] ? toHumanLabel(profileState.goals[0]) : 'Build';
};

const normalizeStats = (stats) => ({
  connectionsCount: Number(stats?.connectionsCount || 0),
  connectionsGrowth: Number(stats?.connectionsGrowth || 0),
  voltzBalance: Number(stats?.voltzBalance || 0),
  voltzGrowth: Number(stats?.voltzGrowth || 0),
});

const fetchProfileStats = async () => {
  const execution = await functions.createExecution(
    CONNECTION_GATEWAY_FUNCTION_ID,
    JSON.stringify({ action: 'get_profile_stats' }),
    false
  );

  let body;
  try {
    body = JSON.parse(execution?.responseBody || '{}');
  } catch {
    throw new Error('Invalid profile stats response.');
  }

  if (body?.error) {
    throw new Error(body.error);
  }

  return normalizeStats(body?.stats || DEFAULT_STATS);
};

const uniqCleanList = (values) => {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = normalizeString(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
};

const safeParseJson = (value, fallback) => {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseTextList = (value, fallback = []) => {
  if (Array.isArray(value)) {
    const clean = uniqCleanList(value);
    return clean.length > 0 ? clean : [...fallback];
  }

  if (typeof value !== 'string') return [...fallback];
  const trimmed = value.trim();
  if (!trimmed) return [...fallback];

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    const parsed = safeParseJson(trimmed, null);
    if (Array.isArray(parsed)) {
      const clean = uniqCleanList(parsed);
      return clean.length > 0 ? clean : [...fallback];
    }
  }

  const rawParts = trimmed.includes(',')
    ? trimmed.split(',')
    : trimmed.includes('\n')
      ? trimmed.split('\n')
      : [trimmed];

  const clean = uniqCleanList(rawParts);
  return clean.length > 0 ? clean : [...fallback];
};

const normalizePhotoSlots = (value) => {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((idx) => {
    const fileId = normalizeString(source[idx]);
    return fileId || null;
  });
};

const buildPhotoUrl = (fileId) => {
  const id = normalizeString(fileId);
  if (!id) return null;
  return String(storage.getFilePreview({
    bucketId: PROFILE_PHOTOS_BUCKET_ID,
    fileId: id,
    width: 1800,
    height: 1800,
    quality: 88,
    output: 'jpg',
  }));
};

const buildPhotoFallbackUrl = (fileId) => {
  const id = normalizeString(fileId);
  if (!id) return null;
  return String(storage.getFileView({
    bucketId: PROFILE_PHOTOS_BUCKET_ID,
    fileId: id,
  }));
};

const listToText = (list) => uniqCleanList(list).join(', ');

// ─── TagInput sub-component ──────────────────────────────────────────────────
function TagInput({ type, chips, setChips, placeholder }) {
  const [val, setVal] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const inputRef = useRef(null);

  const getSuggestions = (v) => {
    if (!v.trim()) { setSuggestions([]); setShowSug(false); return; }
    const low = v.trim().toLowerCase();
    const list = SUGG[type] || [];
    const existing = chips.map(c => c.toLowerCase());
    let matches = list.filter(x => x.toLowerCase().startsWith(low) && !existing.includes(x.toLowerCase()));
    if (!matches.length) matches = list.filter(x => x.toLowerCase().includes(low) && !existing.includes(x.toLowerCase()));
    setSuggestions(matches.slice(0,6));
    setShowSug(true);
  };

  const addTag = (v) => {
    const t = v.trim();
    if (!t || chips.includes(t)) return;
    setChips(prev => [...prev, t]);
    setVal(''); setSuggestions([]); setShowSug(false);
  };

  const onFocus = () => {
    setTimeout(() => inputRef.current?.scrollIntoView({ behavior:'smooth', block:'center' }), 100);
  };

  return (
    <div className="add-wrap">
      <input
        ref={inputRef}
        className="tag-add-input"
        placeholder={placeholder}
        value={val}
        onChange={e => { setVal(e.target.value); getSuggestions(e.target.value); }}
        onKeyDown={e => {
          if (e.key==='Enter') { e.preventDefault(); if(val.trim()) addTag(val); }
          if (e.key==='Escape') { setShowSug(false); }
        }}
        onBlur={() => setTimeout(() => setShowSug(false), 150)}
        onFocus={onFocus}
        autoComplete="off"
      />
      {showSug && (
        <div className="suggestion-list">
          {suggestions.length ? suggestions.map(m => (
            <div key={m} className="suggestion-item" onMouseDown={e => { e.preventDefault(); addTag(m); }}>{m}</div>
          )) : (
            <div className="suggestion-empty">Press Enter to add "{val.trim()}"</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GrowthCard sub-component ────────────────────────────────────────────────
function GrowthCard({ stat, titleColor }) {
  const [period, setPeriod] = useState('1w');
  const chart = renderChartSVG(stat, period);
  const title = stat==='conn' ? 'Connection growth' : 'Voltz over time';
  return (
    <div className="growth-card">
      <div className="growth-header">
        <span className="growth-title" style={titleColor ? {color:titleColor} : {}}>{title}</span>
        <div className="growth-period-row">
          {['1w','1m','3m'].map(p => (
            <button key={p} className={`growth-period-btn${period===p?' active':''}`} onClick={() => setPeriod(p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="growth-chart-wrap">
        <svg width="100%" height="80" viewBox="0 0 300 80" preserveAspectRatio="none">
          <polygon points={chart.fillPts} fill={chart.fillColor}/>
          <polyline points={chart.polyPts} fill="none" stroke={chart.lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="growth-footer">
        <span className="growth-num" style={titleColor ? {color:titleColor} : {}}>{chart.num}</span>
        <span className="growth-change" style={{color: chart.changeColor}}>{chart.change}</span>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function SuperchargedProfile() {
  // inject CSS once
  useEffect(() => {
    const id = 'sc-global-css';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }

    return () => {
      const injected = document.getElementById(id);
      if (injected) injected.remove();
    };
  }, []);

  // ── Profile state ──
  const [profile, setProfile] = useState(DEFAULT_PROFILE_STATE);
  const [profileRowId, setProfileRowId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [freeTextResponses, setFreeTextResponses] = useState({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // ── Stats state ──
  const [stats, setStats] = useState({
    ...DEFAULT_STATS,
  });

  // ── Photos ──
  const [photoFileIds, setPhotoFileIds] = useState([null, null, null]);
  const [photos, setPhotos] = useState([null, null, null]);
  const [photoBusySlot, setPhotoBusySlot] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const fileRef0 = useRef(), fileRef1 = useRef(), fileRef2 = useRef();
  const touchStartXRef = useRef(null);
  const skipNextTapCycleRef = useRef(false);
  const fileRefs = [fileRef0, fileRef1, fileRef2];

  // ── Panel state ──
  const [editOpen, setEditOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [voltzOpen, setVoltzOpen] = useState(false);
  const [profilePanel, setProfilePanel] = useState({ open:false, data:null });

  // ── Accordion state ──
  const [musicOpen, setMusicOpen] = useState(false);
  const [hobbiesOpen, setHobbiesOpen] = useState(false);
  const [socsOpen, setSocsOpen] = useState(false);

  // ── Edit panel local state (initialised on open) ──
  const [editData, setEditData] = useState(null);

  const applyProfileRow = useCallback((row) => {
    const parsedFreeText = safeParseJson(row?.free_text_responses, {});
    const profileUi = parsedFreeText?.profile_ui && typeof parsedFreeText.profile_ui === 'object'
      ? parsedFreeText.profile_ui
      : {};

    const music = parseTextList(profileUi.music ?? row?.music, DEFAULT_PROFILE_STATE.music);
    const hobbies = parseTextList(profileUi.hobbies ?? row?.hobby, DEFAULT_PROFILE_STATE.hobbies);
    const campus = parseTextList(profileUi.campus ?? row?.societies, DEFAULT_PROFILE_STATE.campus);
    const goals = parseTextList(profileUi.goals ?? row?.goals, DEFAULT_PROFILE_STATE.goals);
    const desiredConnections = parseTextList(profileUi.desired_connections ?? row?.desired_connections, DEFAULT_PROFILE_STATE.desiredConnections);
    const primaryIntent = normalizeString(profileUi.primary_intent || row?.primary_intent) || DEFAULT_PROFILE_STATE.primaryIntent;
    const projectStage = normalizeString(profileUi.project_stage || row?.project_stage) || DEFAULT_PROFILE_STATE.projectStage;
    const careerField = normalizeString(profileUi.career_field || row?.career_field) || DEFAULT_PROFILE_STATE.careerField;

    const roleSource = profileUi.roles && typeof profileUi.roles === 'object' ? profileUi.roles : {};
    const roles = campus.reduce((acc, name) => {
      acc[name] = normalizeString(roleSource[name]) || 'Member';
      return acc;
    }, {});

    const photoIds = normalizePhotoSlots(profileUi.photo_file_ids);

    setProfile({
      firstName: normalizeString(row?.first_name) || DEFAULT_PROFILE_STATE.firstName,
      lastName: normalizeString(row?.last_name) || DEFAULT_PROFILE_STATE.lastName,
      college: normalizeString(row?.college) || DEFAULT_PROFILE_STATE.college,
      subject: normalizeString(row?.study_subject || row?.course) || DEFAULT_PROFILE_STATE.subject,
      year: normalizeString(row?.year_of_study || row?.stage) || DEFAULT_PROFILE_STATE.year,
      bio: normalizeString(profileUi.bio || row?.building_description) || DEFAULT_PROFILE_STATE.bio,
      music,
      hobbies,
      campus,
      primaryIntent,
      goals,
      desiredConnections,
      projectStage,
      careerField,
      roles,
    });

    setFreeTextResponses(parsedFreeText && typeof parsedFreeText === 'object' ? parsedFreeText : {});
    setPhotoFileIds(photoIds);
    setPhotos(photoIds.map((id) => buildPhotoUrl(id)));
    setPhotoIdx((prev) => {
      if (photoIds[prev]) return prev;
      const firstWithPhoto = photoIds.findIndex(Boolean);
      return firstWithPhoto >= 0 ? firstWithPhoto : 0;
    });
  }, []);

  const buildProfileUiPayload = (profileState, photoIds) => {
    const current = freeTextResponses && typeof freeTextResponses === 'object' ? freeTextResponses : {};
    const currentUi = current.profile_ui && typeof current.profile_ui === 'object' ? current.profile_ui : {};
    return {
      ...current,
      profile_ui: {
        ...currentUi,
        bio: normalizeString(profileState.bio),
        music: uniqCleanList(profileState.music),
        hobbies: uniqCleanList(profileState.hobbies),
        campus: uniqCleanList(profileState.campus),
        primary_intent: normalizeString(profileState.primaryIntent),
        goals: uniqCleanList(profileState.goals),
        desired_connections: uniqCleanList(profileState.desiredConnections),
        project_stage: normalizeString(profileState.projectStage),
        career_field: normalizeString(profileState.careerField),
        roles: profileState.roles || {},
        photo_file_ids: normalizePhotoSlots(photoIds),
      },
    };
  };

  const persistPhotoSlots = async (nextPhotoIds) => {
    if (!profileRowId) return;

    const nextFreeText = buildProfileUiPayload(profile, nextPhotoIds);
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: PROFILES_TABLE,
      rowId: profileRowId,
      data: {
        free_text_responses: JSON.stringify(nextFreeText),
      },
    });

    setFreeTextResponses(nextFreeText);
    setPhotoFileIds(nextPhotoIds);
    setPhotos(nextPhotoIds.map((id) => buildPhotoUrl(id)));
    setPhotoIdx((prev) => {
      if (nextPhotoIds[prev]) return prev;
      const firstWithPhoto = nextPhotoIds.findIndex(Boolean);
      return firstWithPhoto >= 0 ? firstWithPhoto : 0;
    });

    if (currentUserId) {
      removeCacheEntry(PROFILE_CACHE_KEY(currentUserId));
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError('');
      let usedCachedProfile = false;

      try {
        const user = await account.get();
        if (!isMounted) return;

        setCurrentUserId(user.$id);

        const cached = readCacheEntry(PROFILE_CACHE_KEY(user.$id), PROFILE_CACHE_TTL_MS);
        const cachedStats = cached?.data?.stats ? normalizeStats(cached.data.stats) : null;
        if (cached?.data?.row) {
          usedCachedProfile = true;
          setProfileRowId(cached.data.row.$id || null);
          applyProfileRow(cached.data.row);
          if (cachedStats) {
            setStats(cachedStats);
          }
          setProfileLoading(false);
        }

        const result = await tables.listRows({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          queries: [Query.equal('user_id', user.$id), Query.limit(1)],
        });

        const row = result.rows?.[0] || null;
        if (!row) {
          if (!usedCachedProfile) {
            setProfileError('No profile row found for this account.');
            setProfileLoading(false);
          }
          return;
        }

        setProfileRowId(row.$id);
        applyProfileRow(row);

        try {
          const nextStats = await fetchProfileStats();

          if (isMounted) {
            setStats(nextStats);
            writeCacheEntry(PROFILE_CACHE_KEY(user.$id), { row, stats: nextStats });
          }
        } catch (statsErr) {
          console.warn('Could not load profile stats, using cached/default values.', statsErr);
          if (isMounted) {
            writeCacheEntry(PROFILE_CACHE_KEY(user.$id), {
              row,
              stats: cachedStats || DEFAULT_STATS,
            });
          }
        }

      } catch (err) {
        if (isMounted && !usedCachedProfile) {
          setProfileError(err?.message || 'Unable to load profile right now.');
        }
      } finally {
        if (isMounted && !usedCachedProfile) setProfileLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [applyProfileRow]);

  const openEdit = () => {
    setEditData({
      firstName: profile.firstName, lastName: profile.lastName,
      college: profile.college, subject: profile.subject, year: profile.year,
      bio: profile.bio,
      music: [...profile.music], hobbies: [...profile.hobbies], campus: [...profile.campus],
      roles: { ...profile.roles },
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editData || !profileRowId) return;

    const p = {
      firstName: normalizeString(editData.firstName),
      lastName: normalizeString(editData.lastName),
      college: normalizeString(editData.college),
      subject: normalizeString(editData.subject),
      year: normalizeString(editData.year),
      bio: normalizeString(editData.bio),
      music: uniqCleanList(editData.music),
      hobbies: uniqCleanList(editData.hobbies),
      campus: uniqCleanList(editData.campus),
      roles: editData.roles && typeof editData.roles === 'object' ? editData.roles : {},
    };

    const safeFirstName = p.firstName || profile.firstName || 'Oxford';
    const safeLastName = p.lastName || profile.lastName || '';

    const normalizedRoles = p.campus.reduce((acc, name) => {
      acc[name] = normalizeString(p.roles[name]) || 'Member';
      return acc;
    }, {});

    const nextProfile = {
      ...profile,
      ...p,
      firstName: safeFirstName,
      lastName: safeLastName,
      roles: normalizedRoles,
    };

    const nextFreeText = buildProfileUiPayload(nextProfile, photoFileIds);

    setProfileSaving(true);
    setProfileError('');
    try {
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: PROFILES_TABLE,
        rowId: profileRowId,
        data: {
          full_name: [safeFirstName, safeLastName].filter(Boolean).join(' ').trim(),
          first_name: safeFirstName,
          last_name: safeLastName,
          college: nextProfile.college,
          study_subject: nextProfile.subject,
          course: nextProfile.subject,
          year_of_study: nextProfile.year,
          stage: nextProfile.year,
          building_description: nextProfile.bio,
          hobby: listToText(nextProfile.hobbies),
          music: listToText(nextProfile.music),
          societies: listToText(nextProfile.campus),
          free_text_responses: JSON.stringify(nextFreeText),
        },
      });

      setFreeTextResponses(nextFreeText);
      setProfile(nextProfile);
      setEditOpen(false);
      if (currentUserId) {
        removeCacheEntry(PROFILE_CACHE_KEY(currentUserId));
      }
    } catch (err) {
      setProfileError(err?.message || 'Unable to save profile right now.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Photo handlers ──
  const handlePhoto = async (idx, file) => {
    if (!file || !profileRowId || !currentUserId) return;
    if (file.type && !ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      setProfileError('Please upload a JPG, PNG, WEBP, or GIF image.');
      return;
    }

    setPhotoBusySlot(idx);
    setProfileError('');

    const oldFileId = photoFileIds[idx];
    let uploadedFileId = null;

    try {
      const uploaded = await storage.createFile(
        PROFILE_PHOTOS_BUCKET_ID,
        ID.unique(),
        file,
        [
          Permission.read(Role.any()),
          Permission.update(Role.user(currentUserId)),
          Permission.delete(Role.user(currentUserId)),
        ]
      );
      uploadedFileId = uploaded.$id;

      const nextPhotoIds = [...photoFileIds];
      nextPhotoIds[idx] = uploadedFileId;
      await persistPhotoSlots(nextPhotoIds);

      if (oldFileId && oldFileId !== uploadedFileId) {
        try {
          await storage.deleteFile(PROFILE_PHOTOS_BUCKET_ID, oldFileId);
        } catch {
          // Ignore cleanup errors; metadata is already updated to the new file.
        }
      }
    } catch (err) {
      if (uploadedFileId) {
        try {
          await storage.deleteFile(PROFILE_PHOTOS_BUCKET_ID, uploadedFileId);
        } catch {
          // Ignore rollback cleanup failures.
        }
      }
      setProfileError(err?.message || 'Unable to upload photo right now.');
    } finally {
      setPhotoBusySlot(null);
    }
  };

  const removePhoto = async (idx) => {
    if (!profileRowId) return;
    const existingFileId = photoFileIds[idx];
    if (!existingFileId) return;

    setPhotoBusySlot(idx);
    setProfileError('');

    try {
      const nextPhotoIds = [...photoFileIds];
      nextPhotoIds[idx] = null;
      await persistPhotoSlots(nextPhotoIds);

      try {
        await storage.deleteFile(PROFILE_PHOTOS_BUCKET_ID, existingFileId);
      } catch {
        // Ignore delete cleanup failures.
      }
    } catch (err) {
      setProfileError(err?.message || 'Unable to remove photo right now.');
    } finally {
      setPhotoBusySlot(null);
    }
  };

  const cyclePhotoByDirection = (direction) => {
    if (!Array.isArray(photos) || photos.every((photo) => !photo)) return;
    const step = direction >= 0 ? 1 : -1;
    for (let i = 1; i <= 2; i += 1) {
      const nextIdx = (photoIdx + (step * i) + 3) % 3;
      if (photos[nextIdx]) {
        setPhotoIdx(nextIdx);
        return;
      }
    }
  };

  const cyclePhoto = (e) => {
    if (e.target.closest('button')) return;
    if (skipNextTapCycleRef.current) {
      skipNextTapCycleRef.current = false;
      return;
    }
    cyclePhotoByDirection(1);
  };

  const handleHeroTouchStart = (e) => {
    const x = e.touches?.[0]?.clientX;
    touchStartXRef.current = Number.isFinite(x) ? x : null;
  };

  const handleHeroTouchEnd = (e) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches?.[0]?.clientX;
    touchStartXRef.current = null;

    if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 24) return;

    skipNextTapCycleRef.current = true;
    if (delta < 0) {
      cyclePhotoByDirection(1);
    } else {
      cyclePhotoByDirection(-1);
    }
  };

  const openConnProfile = (person) => setProfilePanel({ open:true, data:person });

  const availablePhotoCount = photos.filter(Boolean).length;
  const hasNavigablePhotos = availablePhotoCount > 1;
  const actualPhotoIndex = photos.slice(0, photoIdx + 1).filter(Boolean).length;
  const photoSlotLabel = `${actualPhotoIndex}/${availablePhotoCount}`;
  const heroPhotoFallback = buildPhotoFallbackUrl(photoFileIds[photoIdx]);

  const intentHeading = deriveIntentHeading(profile);
  const intentPrimaryPill = profile.goals[0] || (profile.projectStage ? `Stage: ${toHumanLabel(profile.projectStage)}` : 'Open to meaningful projects');
  const intentSecondaryPills = (
    (profile.desiredConnections.length ? profile.desiredConnections : profile.goals.slice(1)).filter(Boolean)
  ).slice(0, 2);

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Oxford Member';
  const subLine  = [profile.college, profile.subject, profile.year].filter(Boolean).join(' \u00a0 ');
  const hobbyColors = ['#FAC775','#EF9F27','#FAEEDA'];

  if (profileLoading) {
    return (
      <div className="sc-profile-root">
        <div className="outer">
          <div className="phone" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 14, color: '#6B6B6B', fontWeight: 500 }}>Loading profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-profile-root">
      <div className="outer">
        <div className="phone">
        {/* Hidden file inputs */}
        {[0,1,2].map(i => (
          <input key={i} ref={fileRefs[i]} type="file" accept="image/*" style={{display:'none'}}
            onChange={e => { handlePhoto(i, e.target.files?.[0]); e.target.value=''; }}/>
        ))}

        {/* ── Scroller ── */}
        <div className="scroller">
          {/* Hero */}
          <div className="hero" onClick={cyclePhoto} onTouchStart={handleHeroTouchStart} onTouchEnd={handleHeroTouchEnd}>
            {hasNavigablePhotos && (
              <>
                <div className="dots-row">
                  {photos.map((p, i) => p ? <div key={i} className={`dot${photoIdx===i?' on':''}`}/> : null)}
                </div>
                <div className="photo-pager" aria-label="Photo navigation">
                  <button
                    type="button"
                    className="photo-pager-btn"
                    aria-label="Previous photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      cyclePhotoByDirection(-1);
                    }}
                  >
                    <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <span className="photo-pager-count">{photoSlotLabel}</span>
                  <button
                    type="button"
                    className="photo-pager-btn"
                    aria-label="Next photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      cyclePhotoByDirection(1);
                    }}
                  >
                    <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
              </>
            )}
            {photos[photoIdx] ? (
              <img
                className="hero-img"
                src={photos[photoIdx]}
                data-fallback-src={heroPhotoFallback || ''}
                alt=""
                style={{display:'block'}}
                onError={(e) => {
                  const fallback = e.currentTarget.dataset.fallbackSrc;
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                    return;
                  }
                  setPhotos((prev) => {
                    if (!prev[photoIdx]) return prev;
                    const next = [...prev];
                    next[photoIdx] = null;
                    return next;
                  });
                }}
              />
            ) : (
              <div className="upload-prompt" onClick={e=>{e.stopPropagation(); if (photoBusySlot !== null) return; fileRef0.current?.click();}}>
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <span>{photoBusySlot === 0 ? 'Uploading photo...' : 'Tap to upload your photo'}</span>
              </div>
            )}
            <button className="photo-edit-btn" onClick={e=>{e.stopPropagation();openEdit();}} aria-label="Edit profile">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <div className="scrim"/>
            <div className="hero-info">
              <div className="name-row">
                <span className="pname">{fullName}</span>
                <div className="oxbadge">
                  <svg width="8" height="10" viewBox="0 0 8 11" fill="none"><polygon points="5,0 0,6 3.5,6 3,11 8,5 4.5,5" fill="#F5C842"/></svg>
                  <span className="oxlabel">Oxford</span>
                </div>
              </div>
              <div className="psub">{subLine}</div>
            </div>
          </div>

          {/* Content */}
          <div className="content">
            {profileError && (
              <div style={{ marginBottom: 10, border: '1px solid #F2D3D3', borderRadius: 12, background: '#FFF8F8', color: '#B34747', fontSize: 12, fontWeight: 500, padding: '10px 12px' }}>
                {profileError}
              </div>
            )}

            {/* Bio */}
            <div className="bio-card">
              <div className="bio-ey">About</div>
              <div className="bio-lead">{profile.bio || 'Tell people what you are building.'}</div>
            </div>

            {/* Here to */}
            <div className="intent-card">
              <div className="i-ey">Here to</div>
              <div className="i-hl"><div className="i-dot"/><span className="i-lbl">{intentHeading}</span></div>
              <div className="i-pills">
                <span className="ip-p">{intentPrimaryPill}</span>
                {intentSecondaryPills.map((pill, idx) => (
                  <span key={`${pill}-${idx}`} className="ip-s">{pill}</span>
                ))}
                {!intentSecondaryPills.length && profile.careerField && (
                  <span className="ip-s">{toHumanLabel(profile.careerField)}</span>
                )}
              </div>
            </div>

            <div className="slp">About me</div>

            {/* Music card */}
            <div className="p-card pc-music">
              <div className="p-header" onClick={() => setMusicOpen(o => !o)}>
                <div className="p-ico">
                  <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <div className="p-txt">
                  <div className="p-label">Listening to</div>
                  {!musicOpen && <>
                    <div className="p-preview-name">{profile.music[0] || '—'}</div>
                    <div className="p-preview-rest">{profile.music.slice(1).join(', ')}{profile.music.length>1?' and more':''}</div>
                  </>}
                </div>
                <div className={`p-chev${musicOpen?' open':''}`}>
                  <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
                </div>
              </div>
              <div className={`p-body${musicOpen?' open':''}`}>
                <div className="music-expanded">
                  <div className="music-tags">
                    {profile.music.map((m,i) => (
                      <span key={m} className={i===0?'music-tag-primary':'music-tag-secondary'}>{m}</span>
                    ))}
                  </div>
                  <div className="music-note">Currently on a Blonde loop. Anything with texture.</div>
                </div>
              </div>
            </div>

            {/* Hobbies card */}
            <div className="p-card pc-hobbies">
              <div className="p-header" onClick={() => setHobbiesOpen(o => !o)}>
                <div className="p-ico">
                  <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <div className="p-txt">
                  <div className="p-label">Outside of work</div>
                  {!hobbiesOpen && <>
                    <div className="p-preview-name">{profile.hobbies.slice(0,3).join(', ')}</div>
                    <div className="p-preview-rest">{profile.hobbies.slice(3).join(', ')}</div>
                  </>}
                </div>
                <div className={`p-chev${hobbiesOpen?' open':''}`}>
                  <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#854F0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
                </div>
              </div>
              <div className={`p-body${hobbiesOpen?' open':''}`}>
                <div className="hobbies-expanded">
                  {profile.hobbies.map((h,i) => (
                    <div key={h} className="hobby-item">
                      <div className="hobby-icon" style={{background: hobbyColors[i%3]}}>{getHobbyIcon(h)}</div>
                      <div className="hobby-name">{h}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Societies card */}
            <div className="p-card pc-socs">
              <div className="p-header" onClick={() => setSocsOpen(o => !o)}>
                <div className="p-ico">
                  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div className="p-txt">
                  <div className="p-label">On campus</div>
                  {!socsOpen && <>
                    <div className="p-preview-name">{profile.campus[0] || '—'}</div>
                    <div className="p-preview-rest">{profile.campus.slice(1).join(', ')}</div>
                  </>}
                </div>
                <div className={`p-chev${socsOpen?' open':''}`}>
                  <svg width="12" height="7" viewBox="0 0 12 7" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5 5-5"/></svg>
                </div>
              </div>
              <div className={`p-body${socsOpen?' open':''}`}>
                <div className="socs-expanded">
                  {profile.campus.map(soc => {
                    const role = profile.roles[soc]||'Member';
                    return (
                      <div key={soc} className="soc-item">
                        <div className="soc-dot"/>
                        <div>
                          <div className="soc-name">{soc}</div>
                          <span className={`soc-badge ${role==='Committee'?'soc-badge-committee':'soc-badge-member'}`}>{role}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="sls">Activity</div>
            <div className="stats-strip">
              <div className="stat-row" onClick={() => setConnOpen(true)}>
                <div className="stat-icon" style={{background:'#E1F5EE'}}>
                  <svg viewBox="0 0 24 24" stroke="#0F6E56" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="stat-text">
                  <div className="stat-num">{stats.connectionsCount.toLocaleString()}</div>
                  <div className="stat-desc">connections made</div>
                  <div className="stat-growth" style={{color:'#0F6E56'}}>+{stats.connectionsGrowth.toLocaleString()} this week</div>
                </div>
                <div className="stat-caret">
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="#C8C8CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5-5 5"/></svg>
                </div>
              </div>
              <div className="stat-row" onClick={() => setVoltzOpen(true)}>
                <div className="stat-icon" style={{background:'#FAEEDA'}}>
                  <svg viewBox="0 0 24 24" stroke="#854F0B" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <div className="stat-text">
                  <div className="stat-num y">{stats.voltzBalance.toLocaleString()}</div>
                  <div className="stat-desc">voltz earned</div>
                  <div className="stat-growth" style={{color:'#BA7517'}}>+{stats.voltzGrowth.toLocaleString()} this week</div>
                </div>
                <div className="stat-caret">
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="#C8C8CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5-5 5"/></svg>
                </div>
              </div>
            </div>

            <GrowthCard stat="conn"/>
            <GrowthCard stat="voltz" titleColor="#C49B0A"/>
          </div>
        </div>

        {/* ── Connections panel ── */}
        <div className={`conn-panel${connOpen?' open':''}`}>
          <div className="conn-nav">
            <button className="conn-back" onClick={() => setConnOpen(false)}>
              <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1L1 7.5 8 14"/></svg> Back
            </button>
            <div className="conn-nav-title">31 Connections</div>
          </div>
          <div className="conn-score-header">Grouped by recency · <span>sorted by match</span></div>
          <div className="conn-list">
            {CONNECTIONS.map((g,gi) => (
              <div key={gi}>
                <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'#AFAFAF',padding:`${gi===0?4:12}px 4px 6px`,fontFamily:"'DM Sans',system-ui,sans-serif"}}>{g.group}</div>
                {g.items.map(p => (
                  <div key={p.name} className="conn-item" style={{cursor:'pointer'}} onClick={() => openConnProfile(p)}>
                    <div className="conn-av" style={{background:p.colour}}>{p.initials}</div>
                    <div className="conn-info">
                      <div className="conn-name">{p.name}</div>
                      <div className="conn-meta">{p.meta}</div>
                    </div>
                    <div className={`csb ${p.scoreClass}`}>{p.score}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Profile mini panel ── */}
        <div className={`conn-panel${profilePanel.open?' open':''}`} style={{zIndex:55}}>
          <div className="conn-nav">
            <button className="conn-back" onClick={() => setProfilePanel({open:false,data:null})}>
              <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1L1 7.5 8 14"/></svg> Back
            </button>
            <div className="conn-nav-title">{profilePanel.data?.name || 'Profile'}</div>
          </div>
          {profilePanel.data && (
            <div className="conn-list" style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:32}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:profilePanel.data.colour,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:600,color:'#FFFEFD',marginBottom:14}}>{profilePanel.data.initials}</div>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:300,fontSize:30,color:'#1A1A1A',letterSpacing:'-0.3px',marginBottom:4,textAlign:'center'}}>{profilePanel.data.name}</div>
              <div style={{fontSize:13,color:'#AFAFAF',marginBottom:14,textAlign:'center'}}>{profilePanel.data.meta}</div>
              <div className={`csb ${profilePanel.data.scoreClass}`} style={{marginBottom:28}}>{profilePanel.data.score}</div>
              <div style={{background:'#FFFEFD',borderRadius:16,padding:'18px 20px',width:'calc(100% - 24px)',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <div style={{fontSize:12,fontStyle:'italic',color:'#AFAFAF'}}>About and more is only visible to connections with a high match.</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Voltz leaderboard panel ── */}
        <div className={`conn-panel${voltzOpen?' open':''}`}>
          <div className="conn-nav">
            <button className="conn-back" onClick={() => setVoltzOpen(false)}>
              <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1L1 7.5 8 14"/></svg> Back
            </button>
            <div className="conn-nav-title">⚡ Voltz</div>
          </div>
          <div style={{margin:'12px 12px 0',background:'linear-gradient(135deg,#2A2820,#3A3628)',borderRadius:16,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,254,253,0.4)',marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>Your rank</div>
              <div style={{fontSize:28,fontWeight:700,color:'#F5C842',letterSpacing:'-0.5px',fontFamily:"'DM Sans',sans-serif"}}>#1</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,254,253,0.4)',marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>Voltz</div>
              <div style={{fontSize:28,fontWeight:700,color:'#FFFEFD',letterSpacing:'-0.5px',fontFamily:"'DM Sans',sans-serif"}}>1,620 <span style={{fontSize:16}}>⚡</span></div>
            </div>
          </div>
          <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'#AFAFAF',padding:'14px 16px 6px',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>All connections</div>
          <div className="conn-list">
            {LEADERBOARD.map(lb => (
              <div key={lb.rank} className="conn-item" style={lb.profile?{cursor:'pointer'}:{}} onClick={lb.profile?()=>openConnProfile(lb.profile):undefined}>
                <div className="lb-rank" style={lb.gold?{color:'#F5C842'}:{}}>{lb.rank}</div>
                <div className="conn-av" style={{background:lb.colour,width:38,height:38,fontSize:12,flexShrink:0}}>{lb.initials}</div>
                <div className="conn-info">
                  <div className="conn-name">{lb.name}</div>
                  <div className="conn-meta">{lb.meta}</div>
                </div>
                <div style={{fontSize:lb.gold?14:13,fontWeight:lb.gold?700:600,color:lb.gold?'#C49B0A':'#AFAFAF',flexShrink:0}}>{lb.voltz} ⚡</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Edit panel ── */}
        <div className={`edit-panel${editOpen?' open':''}`}>
          <div className="edit-header">
            <button className="edit-cancel" onClick={() => setEditOpen(false)}>Cancel</button>
            <span className="edit-title-text">Edit profile</span>
            <button className="edit-save" onClick={saveEdit} disabled={profileSaving || photoBusySlot !== null} style={(profileSaving || photoBusySlot !== null) ? { opacity: 0.55, cursor: 'default' } : undefined}>
              {profileSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {editData && (
            <div className="edit-body">
              {/* Photo strip */}
              <div className="edit-photo-strip">
                {[0,1,2].map(i => (
                  <div key={i} className="edit-photo-slot" onClick={() => fileRefs[i].current?.click()}>
                    {photos[i] ? (
                      <img
                        src={photos[i]}
                        data-fallback-src={buildPhotoFallbackUrl(photoFileIds[i]) || ''}
                        alt=""
                        style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
                        onError={(e) => {
                          const fallback = e.currentTarget.dataset.fallbackSrc;
                          if (fallback && e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback;
                            return;
                          }
                          setPhotos((prev) => {
                            if (!prev[i]) return prev;
                            const next = [...prev];
                            next[i] = null;
                            return next;
                          });
                        }}
                      />
                    ) : (
                      <>
                        <svg className="slot-icon" viewBox="0 0 24 24">
                          {i===0 ? <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></> : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
                        </svg>
                        <div className="slot-label">{i===0?'Main photo':`Photo ${i+1}`}</div>
                      </>
                    )}
                    {photos[i] && (
                      <div className="edit-photo-slot-actions">
                        <button className="edit-photo-slot-btn" onClick={e=>{e.stopPropagation();fileRefs[i].current?.click()}}>Change</button>
                        <button className="edit-photo-slot-btn" onClick={e=>{e.stopPropagation();removePhoto(i)}}>Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* About */}
              <div className="edit-section">
                <div className="edit-section-label">About</div>
                <textarea className="edit-textarea" value={editData.bio}
                  onChange={e => setEditData(d=>({...d,bio:e.target.value}))}
                  placeholder="Write something about yourself..."
                  style={{height:'auto'}}
                  rows={3}/>
                <div className="edit-count" style={{color:editData.bio.length>200?'#E24B4A':'#AFAFAF'}}>{editData.bio.length} / 200</div>
              </div>

              {/* Identity */}
              <div className="edit-section">
                <div className="edit-section-label">Identity</div>
                {[
                  ['First name','firstName'],['Last name','lastName'],
                  ['College','college'],['Subject','subject'],['Year','year']
                ].map(([label,key]) => (
                  <div key={key} className="edit-field">
                    <div className="edit-label">{label}</div>
                    <input className="edit-input" type="text" value={editData[key]}
                      onChange={e => setEditData(d=>({...d,[key]:e.target.value}))}/>
                  </div>
                ))}
              </div>

              {/* Music */}
              <div className="edit-section">
                <div className="edit-section-label">Listening to</div>
                <div className="tag-chips-wrap">
                  {editData.music.map(m => (
                    <div key={m} className="tag-chip music" onClick={() => setEditData(d=>({...d,music:d.music.filter(x=>x!==m)}))}>
                      {m} <button className="chip-x" style={{opacity:0.7,width:10,marginLeft:2}} onClick={e=>{e.stopPropagation();setEditData(d=>({...d,music:d.music.filter(x=>x!==m)}))}}>×</button>
                    </div>
                  ))}
                </div>
                <TagInput type="music" chips={editData.music} setChips={v => setEditData(d=>({...d,music:typeof v==='function'?v(d.music):v}))} placeholder="Add an artist..."/>
              </div>

              {/* Hobbies */}
              <div className="edit-section">
                <div className="edit-section-label">Outside of work</div>
                <div className="tag-chips-wrap">
                  {editData.hobbies.map(h => (
                    <div key={h} className="tag-chip hobbies" onClick={() => setEditData(d=>({...d,hobbies:d.hobbies.filter(x=>x!==h)}))}>
                      {h} <button className="chip-x" style={{opacity:0.7,width:10,marginLeft:2}} onClick={e=>{e.stopPropagation();setEditData(d=>({...d,hobbies:d.hobbies.filter(x=>x!==h)}))}}>×</button>
                    </div>
                  ))}
                </div>
                <TagInput type="hobbies" chips={editData.hobbies} setChips={v => setEditData(d=>({...d,hobbies:typeof v==='function'?v(d.hobbies):v}))} placeholder="Add an interest..."/>
              </div>

              {/* Societies */}
              <div className="edit-section">
                <div className="edit-section-label">On campus</div>
                <div className="tag-chips-wrap">
                  {editData.campus.map(s => (
                    <div key={s} className="tag-chip campus" onClick={() => setEditData(d=>({...d,campus:d.campus.filter(x=>x!==s)}))}>
                      {s} <button className="chip-x" style={{opacity:0.7,width:10,marginLeft:2}} onClick={e=>{e.stopPropagation();setEditData(d=>({...d,campus:d.campus.filter(x=>x!==s)}))}}>×</button>
                    </div>
                  ))}
                </div>
                {editData.campus.length > 0 && (
                  <div>
                    <div className="edit-label" style={{marginTop:14,marginBottom:8}}>Role by society</div>
                    {editData.campus.map(soc => {
                      const role = editData.roles[soc]||'Member';
                      const isCom = role==='Committee';
                      return (
                        <div key={soc} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid rgba(0,0,0,0.07)'}}>
                          <span style={{fontSize:13,color:'#1A1A1A',fontFamily:"'DM Sans',sans-serif"}}>{soc}</span>
                          <button onClick={() => setEditData(d=>({...d,roles:{...d.roles,[soc]:isCom?'Member':'Committee'}}))}
                            style={{borderRadius:999,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer',border:'1.5px solid',fontFamily:"'DM Sans',sans-serif",
                              background:isCom?'#CECBF6':'rgba(83,74,183,0.08)',
                              color:isCom?'#26215C':'#534AB7',
                              borderColor:isCom?'#26215C':'#534AB7'}}>
                            {role}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <TagInput type="socs" chips={editData.campus} setChips={v => setEditData(d=>({...d,campus:typeof v==='function'?v(d.campus):v}))} placeholder="Add a society or club..."/>
              </div>
            </div>
          )}
      </div>
      </div>
      </div>
    </div>
  );
}
