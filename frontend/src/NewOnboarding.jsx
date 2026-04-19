import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { account, tables, ID, DB_ID, PROFILES_TABLE, Query } from './lib/appwrite';
import './NewOnboarding.css';

const OXFORD_COLLEGES = ['All Souls', 'Balliol', 'Brasenose', 'Christ Church', 'Corpus Christi', 'Exeter', 'Green Templeton', 'Harris Manchester', 'Hertford', 'Jesus', 'Keble', 'Kellogg', 'Lady Margaret Hall', 'Linacre', 'Lincoln', 'Magdalen', 'Mansfield', 'Merton', 'New College', 'Nuffield', 'Oriel', 'Pembroke', "Queen's", 'Reuben', "Regent's Park", 'Somerville', "St Anne's", "St Antony's", "St Catherine's", 'St Cross', 'St Edmund Hall', "St Hilda's", "St Hugh's", "St John's", "St Peter's", 'Trinity', 'University', 'Wadham', 'Wolfson', 'Worcester', 'Wycliffe Hall'];

const CAREER_SUB_DATA={
  'Finance and investing':{
    heading:'Where in finance?', whisper:'Lets us match you with people on the exact same track.',
    chips:['Investment banking','Private equity','Hedge funds','Venture capital','Asset management','Corporate finance','Financial consulting','Fintech','Trading','Impact investing','Not sure yet']
  },
  'Consulting and strategy':{
    heading:'What type of consulting?', whisper:'',
    chips:['Strategy consulting (MBB)','Big 4 consulting','Boutique or specialist','In-house strategy','Public sector consulting','Tech consulting','Not sure yet']
  },
  'Technology and engineering':{
    heading:'What area of tech?', whisper:'',
    chips:['Software engineering','Machine learning and AI','Cybersecurity','Hardware and embedded','Data engineering','DevOps and infrastructure','Biotech or deep tech','Not sure yet']
  },
  'Startups and entrepreneurship':{
    heading:'What are you looking to build?', whisper:'',
    chips:['I am already building something','Consumer app or platform','B2B SaaS','Deep tech or science-based','Social enterprise','Marketplace','Media or content','Hardware or physical product','Not sure yet']
  },
  'Law':{
    heading:'What area of law?', whisper:'',
    chips:['Corporate and M&A','Litigation','Criminal','Human rights and public law','IP and tech','International law','Barrister route','Not sure yet']
  },
  'Medicine and healthcare':{
    heading:'Which direction?', whisper:'',
    chips:['Clinical medicine','Research and academia','Health policy','Biotech or pharma','Global health','Mental health','Medical technology','Not sure yet']
  },
  'Academia and research':{
    heading:'What kind of research?', whisper:'',
    chips:['Theoretical or pure research','Applied research','Interdisciplinary','Policy-facing research','Commercialising research','Not sure yet']
  },
  'Policy and public sector':{
    heading:'Where in policy?', whisper:'',
    chips:['Civil service','Think tanks','International institutions','Political advisory','Local government','Regulatory bodies','Not sure yet']
  },
  'Creative industries and media':{
    heading:'What kind of creative work?', whisper:'',
    chips:['Journalism and writing','Film and television','Music','Architecture and design','Advertising and branding','Publishing','Digital content','Not sure yet']
  },
  'Social impact and NGOs':{
    heading:'What kind of impact work?', whisper:'',
    chips:['International development','Climate and environment','Education','Economic empowerment','Human rights','Effective altruism','Not sure yet']
  },
  'Other':{
    heading:'Can you say more?', whisper:'',
    chips:['Still exploring','Multiple interests','Something unconventional','I will fill this in later']
  }
};

function TopoBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lines = [];
    let globalPhase = 0;
    let lastDraw = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      lines = [];
      const count = Math.floor(canvas.height / 10);
      for (let i = 0; i < count; i++) {
        lines.push({
          y: (i / count) * canvas.height,
          amp: 6 + Math.random() * 8,
          freq: 0.004 + Math.random() * 0.003,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };
    const draw = (ts) => {
      requestAnimationFrame(draw);
      if (ts - lastDraw < 33) return;
      lastDraw = ts;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      globalPhase += 0.0003;
      ctx.strokeStyle = 'rgba(26,26,26,1)';
      ctx.lineWidth = 0.6;
      lines.forEach(l => {
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 4) {
          const y = l.y + Math.sin(x * l.freq + globalPhase + l.phase) * l.amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    };
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(draw);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return <canvas id="topo" ref={canvasRef} />;
}

const INTERSTITIALS = ['7'];
const deriveCollegeFromEmail = (value) => {
  const domain = value.split('@')[1] || '';
  const collegeDomain = domain.replace(/\.ox\.ac\.uk$/i, '').trim();
  if (!collegeDomain) return '';

  const normalize = (input) => input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = normalize(collegeDomain.split('.')[0] || collegeDomain);
  const match = OXFORD_COLLEGES.find((college) => normalize(college) === target);
  if (match) return match;

  const fallback = collegeDomain
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
  return fallback;
};

const StepWrapper = ({ id, children, isInterstitial, center }) => {
  return (
    <Motion.div
      key={id}
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={`ob-step active visible ${isInterstitial ? "interstitial" : ""}`}
      style={{ display: "flex", ...(center ? { alignItems: "center", textAlign: "center", width: 560, padding: 0 } : {}) }}
      id={id}
    >
      {children}
    </Motion.div>
  );
};

export default function NewOnboarding({ user, onComplete, onAuth }) {
  const initialStep = user ? '1' : 'cover';
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [history, setHistory] = useState([]);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bdayDay, setBdayDay] = useState('');
  const [bdayMonth, setBdayMonth] = useState('');
  const [bdayYear, setBdayYear] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['','','','','','']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [confirmPwVisible, setConfirmPwVisible] = useState(false);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [studySubject, setStudySubject] = useState('');
  
  const [rank1Cat, setRank1Cat] = useState('');
  const [userGoals, setUserGoals] = useState([]);
  const [answers, setAnswers] = useState({});
  const [friendInputs, setFriendInputs] = useState(['', '', '']);
  const [friendVisuals, setFriendVisuals] = useState([
    { state: 'empty', value: '' },
    { state: 'empty', value: '' },
    { state: 'empty', value: '' },
  ]);
  const [activeFriendPopover, setActiveFriendPopover] = useState(null);
  const friendBubbleRefs = useRef([null, null, null]);
  const friendPopoverRefs = useRef([null, null, null]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEndScreen, setShowEndScreen] = useState(false);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (activeFriendPopover === null) return;
      const bubble = friendBubbleRefs.current[activeFriendPopover];
      const popover = friendPopoverRefs.current[activeFriendPopover];
      if (bubble?.contains(event.target) || popover?.contains(event.target)) return;
      setActiveFriendPopover(null);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [activeFriendPopover]);

  
  const stepOrder = useMemo(() => {
    let pre = ['cover', 'login', '1', '2bday', '2u', '3', '5', '5pw', '6', '6study', '6year', '7', '8'];
    if (user) {
      pre = pre.filter(s => !['cover', 'login', '3', '5', '5pw'].includes(s));
    }
    let cond = [];
    if (rank1Cat === 'professional') {
      cond = ['q-career'];
      if (answers['career'] === 'Other') cond.push('q-career-other');
      else {
        if (answers['career']) cond.push('q-career-sub');
        if (answers['career-sub'] === 'Other') cond.push('q-career-sub-other');
      }
      if (answers['career'] === 'Startups and entrepreneurship' && answers['career-sub'] === 'I am already building something') {
        cond.push('q-building-desc');
      }
      if (answers['career'] === 'Startups and entrepreneurship') {
        cond.push('q-startup-conntype');
      } else if (answers['career']) {
        cond.push('q-conntype');
      }
      if (userGoals.some(g => g === 'find co-founders' || g === 'find collaborators')) {
        cond.push('q-project');
      }
      if (answers['career']) cond.push('q-social');
    } else if (rank1Cat === 'social') {
      cond = ['q-social', 'q-friendship'];
    } else if (rank1Cat === 'romantic') {
      cond = ['q-romantic-sexuality', 'q-romantic-status', 'q-dating', 'q-dating-appearance', 'q-dating-personality', 'q-dating-hobbies'];
    } else if (rank1Cat === 'academic') {
      cond = ['q-intellect', 'q-study-wish', 'q-intellectual-ambition', 'q-intellectual-venue', 'q-conntype'];
    }
    const post = ['q-hobby', 'q-societies', 'q-music', 'q-friends', 'confirm'];
    return [...pre, ...cond, ...post];
  }, [user, rank1Cat, answers, userGoals]);

  const progressSteps = useMemo(() => {
    return stepOrder.filter(s => s !== 'cover' && s !== 'login' && !INTERSTITIALS.includes(s));
  }, [stepOrder]);

  const updateAnswer = (key, value) => {
    setAnswers(prev => ({...prev, [key]: value}));
  };

  const toggleArrayAnswer = (key, value, max = null) => {
    setAnswers(prev => {
      const arr = prev[key] || [];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter(v => v !== value) };
      } else {
        if (max && arr.length >= max) {
          const newArr = [...arr];
          newArr.shift();
          newArr.push(value);
          return { ...prev, [key]: newArr };
        }
        return { ...prev, [key]: [...arr, value] };
      }
    });
  };

  const rankGoal = (goal) => {
    let newGoals = [...userGoals];
    if (newGoals.includes(goal)) {
      newGoals = newGoals.filter(g => g !== goal);
    } else {
      if (newGoals.length >= 4) return;
      newGoals.push(goal);
    }
    setUserGoals(newGoals);
    if (newGoals.length > 0) {
      setRank1Cat(newGoals[0]);
    } else {
      setRank1Cat('');
    }
  };

  const goNext = () => {
    setError('');
    const idx = stepOrder.indexOf(currentStep);
    if (idx < stepOrder.length - 1) {
      setHistory(prev => [...prev, currentStep]);
      setCurrentStep(stepOrder[idx + 1]);
    }
  };

  const goNextConditional = () => {
    setActiveFriendPopover(null);
    goNext();
  };

  const goBack = () => {
    setError('');
    if (history.length > 0) {
      const prevStep = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentStep(prevStep);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      await account.createEmailPasswordSession(loginEmail, loginPassword);
      const u = await account.get();
      setLoading(false);
      onAuth(u); // Let App.jsx handle the rest!
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  const handleSignUp = async () => {
    try {
      setLoading(true);
      await account.create(ID.unique(), email, password, firstName + ' ' + lastName);
      await account.createEmailPasswordSession(email, password);
      setLoading(false);
      goNext();
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  const openFriendPopover = (idx) => {
    setActiveFriendPopover(idx);
    setTimeout(() => {
      friendPopoverRefs.current[idx]?.querySelector('input')?.focus();
    }, 50);
  };

  const commitFriend = (idx, rawValue) => {
    const value = rawValue.trim();
    if (!value) return;

    setFriendInputs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });

    const isOxford = /\.ox\.ac\.uk$/i.test(value);
    setFriendVisuals((prev) => {
      const next = [...prev];
      next[idx] = isOxford ? { state: 'verified', value } : { state: 'invite', value };
      return next;
    });

    setActiveFriendPopover(null);
  };

  const copyFriendInvite = async (button) => {
    const link = 'https://supercharged.ox.ac.uk/invite/' + (user?.$id || '');
    await navigator.clipboard.writeText(link);
    alert('Referral link copied to clipboard!');
    if (button) {
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = 'Invite';
      }, 2000);
    }
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      const u = user || await account.get();
      
      const payload = {
        user_id: u.$id,
        full_name: firstName + ' ' + lastName,
        primary_intent: rank1Cat || 'professional',
        email: u.email || email,
        first_name: firstName,
        last_name: lastName,
        birthday_day: bdayDay,
        birthday_month: bdayMonth,
        birthday_year: bdayYear,
        username: username,
        college: answers['college'] || '',
        study_subject: studySubject,
        year_of_study: answers['year'] || '',
        course: studySubject,
        stage: answers['year'] || '',
        career_subfield: answers['career-sub'] || '',
        building_description: answers['building-desc'] || '',
        free_text_responses: JSON.stringify(answers),
        goals: userGoals,
        career_field: answers['career'] || '',
        desired_connections: answers['conntype'] || answers['startup-conntype'] || [],
        social_circles: answers['social'] || [],
        friendship_values: answers['friendship'] || [],
        intellectual_venue: answers['venue'] || '',
        intellectual_ambition: answers['intambition'] || '',
        study_wish: answers['study-wish'] || '',
        project_stage: answers['project'] || '',
        relationship_intent: answers['dating'] || '',
        relationship_status: answers['relstatus'] || '',
        sexuality: answers['sexuality'] || '',
        dating_appearance: answers['dapp'] || [],
        dating_personality: answers['dating-personality'] || [],
        dating_hobbies: answers['dhob'] || [],
        hobby: answers['hobby'] || '',
        music: answers['music'] || '',
        societies: answers['societies'] || '',
        friend_references: friendInputs.map((friend) => friend.trim()).filter(Boolean),
        is_onboarding_complete: true,
        is_indexed: false
      };

      const result = await tables.listRows({
        databaseId: DB_ID,
        tableId: PROFILES_TABLE,
        queries: [Query.equal('user_id', u.$id)]
      });

      let docId;
      if (result.rows.length > 0) {
        docId = result.rows[0].$id;
        await tables.updateRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: docId,
          data: payload
        });
      } else {
        const row = await tables.createRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: ID.unique(),
          data: payload
        });
        docId = row.$id;
      }
      
      setLoading(false);
      setShowEndScreen(true);
      setTimeout(() => {
        onComplete(docId);
      }, 2500);

    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  const getBdayAge = () => {
    if (!bdayDay || !bdayMonth || !bdayYear || bdayYear.length < 4) return -1;
    const dob = new Date(+bdayYear, +bdayMonth - 1, +bdayDay);
    if (isNaN(dob.getTime())) return -1;
    return (new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000);
  };

  const bdayValid = getBdayAge() >= 18;
  const usernameValid = username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
  const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.ox\.ac\.uk$/.test(email.toLowerCase()) && !email.toLowerCase().endsWith('@ox.ac.uk');
  const codeValid = code.join('').length === 6 || code.join('') === '123456';
  const pwValid = password.length >= 8 && password === confirmPassword;

  return (
    <div className="new-onboarding selection:bg-accent selection:text-text">
      <TopoBackground />
      
      <div id="logo">
        <svg width="14" height="18" viewBox="0 0 14 18" fill="none"><polygon points="8,0 1,10 7,10 6,18 13,8 7,8" fill="#F5C842"/></svg>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A1A', letterSpacing: '-0.01em' }}>supercharged</span>
      </div>

      <div id="progress-dots" style={{ opacity: (currentStep === 'cover' || currentStep === 'login' || INTERSTITIALS.includes(currentStep) || currentStep === 'confirm') ? 0 : 1 }}>
        {progressSteps.map((s, i) => {
          const sIdx = progressSteps.indexOf(currentStep);
          let cls = 'pdot';
          if (i === sIdx) cls += ' active';
          else if (i < sIdx) cls += ' done';
          return <div key={s} className={cls} />;
        })}
      </div>

      <button
        id="back-btn"
        className={currentStep !== 'cover' && currentStep !== 'login' && currentStep !== 'confirm' ? 'visible' : ''}
        onClick={goBack}
      >
        &#8592; Back
      </button>

      <div id="ob-overlay" style={{ opacity: showEndScreen ? 0 : 1 }}>
        <AnimatePresence initial={false} mode="sync">
          
          {currentStep === 'cover' && (
<StepWrapper key="cover" currentStep={currentStep} id="cover">
            <div className="cover-svg-wrap">
              <svg viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <line x1="90" y1="60" x2="40" y2="30" stroke="#DDDBD8" strokeWidth="1.2"/>
                <line x1="90" y1="60" x2="150" y2="28" stroke="#DDDBD8" strokeWidth="1.2"/>
                <line x1="90" y1="60" x2="155" y2="80" stroke="#DDDBD8" strokeWidth="1.2"/>
                <line x1="90" y1="60" x2="32" y2="85" stroke="#DDDBD8" strokeWidth="1.2"/>
                <line x1="90" y1="60" x2="100" y2="100" stroke="#DDDBD8" strokeWidth="1.2"/>
                <circle cx="40" cy="30" r="4" fill="#DDDBD8"/>
                <circle cx="150" cy="28" r="4" fill="#DDDBD8"/>
                <circle cx="155" cy="80" r="4" fill="#DDDBD8"/>
                <circle cx="32" cy="85" r="4" fill="#DDDBD8"/>
                <circle cx="100" cy="100" r="3.5" fill="#DDDBD8"/>
                <circle cx="90" cy="60" r="7" fill="#F5C842"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 300, fontSize: 40, lineHeight: 1.1, color: 'var(--text)', marginBottom: 12 }}>The network that works<br/>for you.</h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 36, lineHeight: 1.5 }}>Oxford University students <span style={{ fontWeight: 600 }}>only</span> &middot; Verified by email</p>
            <button className="btn-accent" style={{ marginBottom: 12 }} onClick={() => { setHistory(['cover']); setCurrentStep('1'); }}>Sign up</button>
            <button className="btn-outline" onClick={() => { setHistory(['cover']); setCurrentStep('login'); }}>Log in</button>
          </StepWrapper>
)}

          {currentStep === 'login' && (
<StepWrapper key="login" currentStep={currentStep} id="login">
            <h1 className="ob-heading">Welcome back.</h1>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Sign in to continue to Supercharged.</p>
            <input className="underline-input" autoFocus type="email" placeholder="you@ox.ac.uk" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            <div className="pw-wrap" style={{ marginTop: 12 }}>
              <input className="underline-input" type={pwVisible ? "text" : "password"} placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginEmail && loginPassword && handleLogin()} />
              <button className="pw-toggle" type="button" onClick={() => setPwVisible(!pwVisible)} tabIndex="-1">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 7C4 1,16 1,19 7C16 13,4 13,1 7Z"/>
                  {pwVisible ? <circle cx="10" cy="7" r="3"/> : <line x1="1" y1="7" x2="19" y2="7"/>}
                </svg>
              </button>
            </div>
            {error && <div className="input-error">{error}</div>}
            <div className="ob-spacer"></div>
            <button className="btn-primary" onClick={handleLogin} disabled={loading || !loginEmail || !loginPassword}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </StepWrapper>
)}

          {currentStep === '1' && (
<StepWrapper key="1" currentStep={currentStep} id="1">
            <h1 className="ob-heading">What's your name?</h1>
            <p className="ob-whisper">So your matches know who they're talking to.</p>
            <input className="underline-input" autoFocus type="text" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ marginBottom: 20 }} />
            <input className="underline-input" type="text" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} onKeyDown={e => e.key === 'Enter' && firstName && lastName && goNext()} />
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!firstName.trim() || !lastName.trim()} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === '2bday' && (
<StepWrapper key="2bday" currentStep={currentStep} id="2bday">
            <h1 className="ob-heading sm">When's your birthday?</h1>
            <p className="ob-whisper" style={{ marginBottom: 24 }}>Used to verify you are 18 or over and to surface age-appropriate matches.</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>Day</div>
                <input autoFocus className="underline-input" type="text" inputMode="numeric" maxLength="2" placeholder="DD" style={{ fontSize: 28, textAlign: 'center' }} value={bdayDay} onChange={e => setBdayDay(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div style={{ flex: 1.4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>Month</div>
                <input className="underline-input" type="text" inputMode="numeric" maxLength="2" placeholder="MM" style={{ fontSize: 28, textAlign: 'center' }} value={bdayMonth} onChange={e => setBdayMonth(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div style={{ flex: 1.6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>Year</div>
                <input className="underline-input" type="text" inputMode="numeric" maxLength="4" placeholder="YYYY" style={{ fontSize: 28, textAlign: 'center' }} value={bdayYear} onChange={e => setBdayYear(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && bdayValid && goNext()} />
              </div>
            </div>
            <div className="input-error">{bdayDay && bdayMonth && bdayYear.length === 4 && !bdayValid ? 'You must be 18 or over to join, or enter a valid date.' : ''}</div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!bdayValid} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === '2u' && (
<StepWrapper key="2u" currentStep={currentStep} id="2u">
            <h1 className="ob-heading sm">Choose your username.</h1>
            <p className="ob-subtext">This is your handle on Supercharged. You can change it later.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Your username is how people find and reference you before a match is made.</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: 'var(--text3)', paddingBottom: 14, flexShrink: 0 }}>@</span>
              <input autoFocus className="underline-input" type="text" placeholder="username" spellCheck="false" style={{ flex: 1, fontSize: 28 }} value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} onKeyDown={e => e.key === 'Enter' && usernameValid && goNext()} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>{username.length}/20</div>
            <div className="input-error">{username.length > 0 && !usernameValid ? 'At least 3 characters. Only letters, numbers, and underscores.' : ''}</div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!usernameValid} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === '3' && (
<StepWrapper key="3" currentStep={currentStep} id="3">
            <h1 className="ob-heading sm">Your Oxford email.</h1>
            <p className="ob-subtext">We'll send a code to verify you're a current student.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>We verify your student status once. We won't email you anything else without permission.</p>
            <input autoFocus className="underline-input" type="email" placeholder="you@college.ox.ac.uk" spellCheck="false" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && emailValid && goNext()} />
            <input autoFocus className="underline-input" type="email" placeholder="you@college.ox.ac.uk" spellCheck="false" value={email} onChange={e => {
              const nextEmail = e.target.value;
              setEmail(nextEmail);
              const inferredCollege = deriveCollegeFromEmail(nextEmail);
              if (inferredCollege) {
                setAnswers(prev => ({ ...prev, college: inferredCollege }));
              }
            }} onKeyDown={e => e.key === 'Enter' && emailValid && goNext()} />
            <div className="input-error">{email.length > 0 && !emailValid && email.includes('@') ? 'Please use your Oxford email address ending in .ox.ac.uk' : ''}</div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!emailValid} onClick={goNext}>Send verification code</button>
          </StepWrapper>
)}

          {currentStep === '5' && (
<StepWrapper key="5" currentStep={currentStep} id="5">
            <h1 className="ob-heading sm">Check your inbox.</h1>
            <p className="ob-subtext">We sent a code to <strong>{email}</strong>.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>This confirms you're a current Oxford student, not just someone with the domain.</p>
            <div className="code-boxes">
              {[0,1,2,3,4,5].map(i => (
                <input
                  key={i}
                  id={`code-box-${i}`}
                  className={`code-box ${code[i] ? 'filled' : ''}`}
                  maxLength={1} type="text" inputMode="numeric"
                  value={code[i]}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newCode = [...code];
                    newCode[i] = val;
                    setCode(newCode);
                    if (val && i < 5) document.getElementById(`code-box-${i+1}`).focus();
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !code[i] && i > 0) {
                      document.getElementById(`code-box-${i-1}`).focus();
                    } else if (e.key === 'Enter' && code.join('').length === 6) {
                      goNext();
                    }
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    const p = e.clipboardData.getData('text').replace(/\D/g, '');
                    const newCode = [...code];
                    for (let j = 0; j < p.length && i + j < 6; j++) newCode[i + j] = p[j];
                    setCode(newCode);
                    const nextFocus = Math.min(i + p.length, 5);
                    document.getElementById(`code-box-${nextFocus}`).focus();
                  }}
                />
              ))}
            </div>
            <div className="input-error" style={{ textAlign: 'center' }}></div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!codeValid} onClick={goNext}>Verify</button>
            <p className="resend-link">Didn't get it? <span>Resend</span></p>
          </StepWrapper>
)}

          {currentStep === '5pw' && (
<StepWrapper key="5pw" currentStep={currentStep} id="5pw">
            <h1 className="ob-heading sm">Create a password.</h1>
            <p className="ob-subtext">At least 8 characters.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>We use standard encryption. We never store your password in plain text.</p>
            <div className="pw-wrap">
              <input autoFocus className="underline-input" type={pwVisible ? "text" : "password"} placeholder="Create password" value={password} onChange={e => setPassword(e.target.value)} />
              <button className="pw-toggle" type="button" onClick={() => setPwVisible(!pwVisible)} tabIndex="-1">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 7C4 1,16 1,19 7C16 13,4 13,1 7Z"/>
                  {pwVisible ? <circle cx="10" cy="7" r="3"/> : <line x1="1" y1="7" x2="19" y2="7"/>}
                </svg>
              </button>
            </div>
            <div className="pw-spacer"></div>
            <div className="pw-wrap">
              <input className="underline-input" type={confirmPwVisible ? "text" : "password"} placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && pwValid && handleSignUp()} />
              <button className="pw-toggle" type="button" onClick={() => setConfirmPwVisible(!confirmPwVisible)} tabIndex="-1">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 7C4 1,16 1,19 7C16 13,4 13,1 7Z"/>
                  {confirmPwVisible ? <circle cx="10" cy="7" r="3"/> : <line x1="1" y1="7" x2="19" y2="7"/>}
                </svg>
              </button>
            </div>
            <div className="input-error">{error || (password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword ? "Passwords don't match." : '')}</div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!pwValid || loading} onClick={handleSignUp}>
              {loading ? 'Creating account...' : 'Continue'}
            </button>
          </StepWrapper>
)}

          {currentStep === '6' && (
<StepWrapper key="6" currentStep={currentStep} id="6">
            <h1 className="ob-heading sm">Which college are you at?</h1>
            <p className="ob-whisper" style={{ marginBottom: 12 }}>Helps us surface connections across colleges, not just your own bubble.</p>
            <input autoFocus className="college-search" type="text" placeholder="Search colleges..." value={collegeSearch} onChange={e => setCollegeSearch(e.target.value)} />
            <div className="chip-grid chip-scroll" style={{ gap: 8 }}>
              {filteredColleges.map(col => (
                <div key={col} className={`chip ${answers['college'] === col ? 'selected' : ''}`} onClick={() => updateAnswer('college', col)}>
                  {col}
                </div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['college']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === '6' && (
<StepWrapper key="6" currentStep={currentStep} id="6">
            <h1 className="ob-heading sm">Which college are you at?</h1>
            <p className="ob-whisper" style={{ marginBottom: 12 }}>Helps us surface connections across colleges, not just your own bubble.</p>
            <input autoFocus className="college-search" type="text" placeholder="Search colleges..." value={collegeSearch} onChange={e => setCollegeSearch(e.target.value)} />
            <div className="chip-grid chip-scroll" style={{ gap: 8 }}>
              {filteredColleges.map(col => (
                <div key={col} className={`chip ${answers['college'] === col ? 'selected' : ''}`} onClick={() => updateAnswer('college', col)}>
                  {col}
                </div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['college']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}
                <div key={y} className={`tap-card ${answers['year'] === y ? 'selected' : ''}`} onClick={() => updateAnswer('year', y)}>{y}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['year']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === '7' && (
<StepWrapper key="7" currentStep={currentStep} id="7">
            <h1 className="ob-heading em" style={{ fontSize: 44 }}>"Your profile runs<br/>in the background."</h1>
            <p className="ob-subtext" style={{ marginBottom: 0 }}>While you're in lectures, Supercharged is computing simulations. By the time you open the app, your best matches are already waiting.</p>
            <div className="flow-diagram">
              <div className="flow-node"><div className="flow-circle">&#128100;</div><div className="flow-label">Your profile</div></div>
              <div className="flow-arrow">&#8594;</div>
              <div className="flow-node"><div className="flow-circle" style={{ borderColor: 'var(--accent)', background: 'rgba(245,200,66,0.08)' }}>&#9889;</div><div className="flow-label">Simulate</div></div>
              <div className="flow-arrow">&#8594;</div>
              <div className="flow-node"><div className="flow-circle">&#129306;</div><div className="flow-label">Top matches</div></div>
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === '8' && (
<StepWrapper key="8" currentStep={currentStep} id="8">
            <h1 className="ob-heading sm">What are you here for?</h1>
            <p className="ob-subtext" style={{ marginBottom: 8 }}>Rank your priorities. Tap in order.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Your top priority determines who we surface first. You can select up to four.</p>
            <div className="rank-cards">
              {[
                { id: 'professional', label: 'Professional', desc: 'Career, startups, investing, consulting, research' },
                { id: 'social', label: 'Social', desc: 'Friendships, events, new people, community' },
                { id: 'romantic', label: 'Romantic', desc: 'Dating and relationships' },
                { id: 'academic', label: 'Academic', desc: 'Study partners, intellectual exchange, research' }
              ].map(g => (
                <div key={g.id} className={`rank-card ${userGoals.includes(g.id) ? 'selected' : ''}`} onClick={() => rankGoal(g.id)}>
                  <div className="rank-badge">{userGoals.indexOf(g.id) + 1 || ''}</div>
                  <div>{g.label}<div style={{ fontSize: 13, fontWeight: 400, color: 'var(--text3)', marginTop: 2 }}>{g.desc}</div></div>
                </div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={userGoals.length === 0} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {/* Dynamic Questions based on path */}
          {currentStep === 'q-career' && (
<StepWrapper key="q-career" currentStep={currentStep} id="q-career">
            <h1 className="ob-heading sm">What field are you heading into?</h1>
            <p className="ob-subtext" style={{ marginBottom: 8 }}>Pick the one that fits best right now.</p>
            <p className="ob-whisper" style={{ marginBottom: 16 }}>Used to weight your matches toward people in or adjacent to your world.</p>
            <div className="chip-grid">
              {Object.keys(CAREER_SUB_DATA).map(c => (
                <div key={c} className={`chip ${answers['career'] === c ? 'selected' : ''}`} onClick={() => updateAnswer('career', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['career']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-career-other' && (
<StepWrapper key="q-career-other" currentStep={currentStep} id="q-career-other">
            <h1 className="ob-heading sm">What field are you heading into?</h1>
            <p className="ob-subtext">Tell us in your own words.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Free-text, matched semantically. Be as specific as you like.</p>
            <input autoFocus className="underline-input" type="text" placeholder="e.g. Science policy, Quantitative ecology..." style={{ fontSize: 22 }} value={answers['career-other'] || ''} onChange={e => updateAnswer('career-other', e.target.value)} onKeyDown={e => e.key === 'Enter' && (answers['career-other']||'').trim().length >= 3 && goNext()} />
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['career-other']||'').trim().length < 3} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-conntype' && (
<StepWrapper key="q-conntype" currentStep={currentStep} id="q-conntype">
            <h1 className="ob-heading sm">What kind of connection are you after?</h1>
            <p className="ob-whisper" style={{ marginBottom: 8 }}>This is the single biggest driver of who we surface for you.</p>
            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text3)', marginBottom: 12 }}>Tap to select in order of priority. Max 3.</p>
            <div className="rank-cards">
              {['Someone 2-5 years ahead of me on this exact path', 'A peer who is as driven as I am to push me', 'Someone already inside who can give me honest, unfiltered advice', 'Someone from a completely different background who can open unexpected doors'].map(c => {
                const arr = answers['conntype'] || [];
                const idx = arr.indexOf(c);
                return (
                  <div key={c} className={`rank-card ${idx > -1 ? 'selected' : ''}`} onClick={() => toggleArrayAnswer('conntype', c, 3)}>
                    <div className="rank-badge">{idx > -1 ? idx + 1 : ''}</div>
                    {c}
                  </div>
                );
              })}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['conntype']||[]).length === 0} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-startup-conntype' && (
<StepWrapper key="q-startup-conntype" currentStep={currentStep} id="q-startup-conntype">
            <h1 className="ob-heading sm">What kind of co-builder are you looking for?</h1>
            <p className="ob-whisper" style={{ marginBottom: 8 }}>The most important decision a founder makes. Be specific.</p>
            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text3)', marginBottom: 12 }}>Tap in order of priority. Max 3.</p>
            <div className="rank-cards">
              {['A technical co-founder who can build what I can\'t', 'A commercial brain to own growth and revenue', 'A creative partner for product and brand', 'A domain expert who knows the space deeply', 'An accountability partner to keep me honest', 'An investor or someone who can open funding doors', 'A first customer or design partner'].map(c => {
                const arr = answers['startup-conntype'] || [];
                const idx = arr.indexOf(c);
                return (
                  <div key={c} className={`rank-card ${idx > -1 ? 'selected' : ''}`} onClick={() => toggleArrayAnswer('startup-conntype', c, 3)}>
                    <div className="rank-badge">{idx > -1 ? idx + 1 : ''}</div>
                    {c}
                  </div>
                );
              })}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['startup-conntype']||[]).length === 0} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-project' && (
<StepWrapper key="q-project" currentStep={currentStep} id="q-project">
            <h1 className="ob-heading sm">Where are you in your project?</h1>
            <p className="ob-whisper" style={{ marginBottom: 16 }}>Matches you with people at a compatible stage, not just anyone building something.</p>
            <div className="chip-grid">
              {['Just an idea', 'Early exploration', 'Building an MVP', 'Launched and growing', 'Not working on anything yet'].map(c => (
                <div key={c} className={`chip ${answers['project'] === c ? 'selected' : ''}`} onClick={() => updateAnswer('project', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['project']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-social' && (
<StepWrapper key="q-social" currentStep={currentStep} id="q-social">
            <h1 className="ob-heading sm">What does your Oxford social life look like?</h1>
            <p className="ob-whisper" style={{ marginBottom: 16 }}>We use this to find people who move in overlapping circles, or usefully different ones.</p>
            <div className="chip-grid">
              {['College events and bops', 'Cafe culture and one-on-ones', 'Sports and fitness', 'Society dinners and formals', 'House parties', 'Arts and cultural events', 'Nights out in town', 'Mostly off-campus', 'Quiet and low-key'].map(c => (
                <div key={c} className={`chip ${(answers['social']||[]).includes(c) ? 'selected' : ''}`} onClick={() => toggleArrayAnswer('social', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['social']||[]).length === 0} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

                <div key={c} className={`tap-card ${answers['sexuality'] === c ? 'selected' : ''}`} onClick={() => updateAnswer('sexuality', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['sexuality']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-romantic-status' && (
<StepWrapper key="q-romantic-status" currentStep={currentStep} id="q-romantic-status">
            <h1 className="ob-heading sm">Where are you right now?</h1>
            <p className="ob-subtext" style={{ marginBottom: 8 }}>Helps us set the right expectations.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Completely private. Never shown publicly without your permission.</p>
            <div className="tap-cards">
              {['Single', 'In a relationship', 'It\'s complicated', 'Prefer not to say'].map(c => (
                <div key={c} className={`tap-card ${answers['relstatus'] === c ? 'selected' : ''}`} onClick={() => updateAnswer('relstatus', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['relstatus']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-dating' && (
<StepWrapper key="q-dating" currentStep={currentStep} id="q-dating">
            <h1 className="ob-heading sm">What are you looking for?</h1>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>We only show you to people who want the same thing.</p>
            <div className="tap-cards">
              {['Something serious', 'Keeping it casual', 'Friendship first, maybe something later', 'Not sure yet, open to seeing'].map(c => (
                <div key={c} className={`tap-card ${answers['dating'] === c ? 'selected' : ''}`} onClick={() => updateAnswer('dating', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['dating']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-dating-appearance' && (
<StepWrapper key="q-dating-appearance" currentStep={currentStep} id="q-dating-appearance">
            <h1 className="ob-heading sm">What draws you in physically?</h1>
            <p className="ob-subtext">Pick what resonates. You can select multiple.</p>
            <p className="ob-whisper" style={{ marginBottom: 16 }}>Used to surface people you're more likely to find genuinely attractive.</p>
            <div className="chip-grid">
              {['Tall', 'Petite', 'Athletic build', 'Slim', 'Curvy', 'Well-dressed', 'Natural look', 'Put-together', 'Edgy or alternative', 'Preppy', 'No strong preference'].map(c => (
                <div key={c} className={`chip ${(answers['dapp']||[]).includes(c) ? 'selected' : ''}`} onClick={() => toggleArrayAnswer('dapp', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['dapp']||[]).length === 0} onClick={goNext}>Continue</button>
            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-dating-personality' && (
<StepWrapper key="q-dating-personality" currentStep={currentStep} id="q-dating-personality">
            <h1 className="ob-heading sm">What do you value most in a partner?</h1>
            <p className="ob-subtext">Pick up to five.</p>
            <p className="ob-whisper" style={{ marginBottom: 16 }}>This shapes who we think you'd genuinely connect with.</p>
            <div className="chip-grid">
              {['Ambition', 'Wit and humour', 'Emotional depth', 'Confidence', 'Kindness', 'Curiosity', 'Independence', 'Warmth', 'Playfulness', 'Directness', 'Creativity', 'Drive'].map(c => (
                <div key={c} className={`chip ${(answers['dating-personality']||[]).includes(c) ? 'selected' : ''}`} onClick={() => toggleArrayAnswer('dating-personality', c, 5)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['dating-personality']||[]).length === 0} onClick={goNext}>Continue</button>
            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-dating-hobbies' && (
<StepWrapper key="q-dating-hobbies" currentStep={currentStep} id="q-dating-hobbies">
            <h1 className="ob-heading sm">What would you want to do together?</h1>
            <p className="ob-subtext">The kind of person who would actually fit into your life.</p>
            <p className="ob-whisper" style={{ marginBottom: 16 }}>Compatibility on how you spend time matters as much as chemistry.</p>
            <div className="chip-grid">
              {['Go to exhibitions or galleries', 'Cook or eat out', 'Hike or be outdoors', 'Go to gigs or festivals', 'Travel spontaneously', 'Stay in and watch films', 'Work out together', 'Talk for hours over coffee', 'Go out and socialise', 'Do creative things together'].map(c => (
                <div key={c} className={`chip ${(answers['dhob']||[]).includes(c) ? 'selected' : ''}`} onClick={() => toggleArrayAnswer('dhob', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['dhob']||[]).length === 0} onClick={goNext}>Continue</button>
            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-intellectual-venue' && (
<StepWrapper key="q-intellectual-venue" currentStep={currentStep} id="q-intellectual-venue">
            <h1 className="ob-heading sm">Where do your best intellectual conversations happen at Oxford?</h1>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Helps us understand how you connect and where you are most yourself.</p>
            <div className="tap-cards">
              {['At tutorials or seminars', 'At dinner', 'At society talks or panels', 'One on one, on a walk or over coffee', 'Honestly, I\'m still looking for those conversations'].map(c => (
                <div key={c} className={`tap-card ${answers['venue'] === c ? 'selected' : ''}`} onClick={() => updateAnswer('venue', c)}>{c}</div>
              ))}
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={!answers['venue']} onClick={goNext}>Continue</button>
          </StepWrapper>
)}

          {currentStep === 'q-hobby' && (
<StepWrapper key="q-hobby" currentStep={currentStep} id="q-hobby">
            <h1 className="ob-heading sm">What are your hobbies?</h1>
            <p className="ob-subtext">The things you actually do outside of work and study.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Shared interests outside of work are one of the strongest predictors of genuine connection.</p>
            <input autoFocus className="underline-input" type="text" placeholder="e.g. climbing, producing music, reading history..." style={{ fontSize: 22 }} value={answers['hobby'] || ''} onChange={e => updateAnswer('hobby', e.target.value)} onKeyDown={e => e.key === 'Enter' && (answers['hobby']||'').trim().length >= 3 && goNext()} />
            <div className="ob-spacer"></div>
            <button className="btn-primary" disabled={(answers['hobby']||'').trim().length < 3} onClick={goNext}>Continue</button>
            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-societies' && (
<StepWrapper key="q-societies" currentStep={currentStep} id="q-societies">
            <h1 className="ob-heading sm">Are you in any societies?</h1>
            <p className="ob-subtext">Clubs, sports teams, or groups at Oxford.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Shared societies are one of the strongest signals for real connection.</p>
            <input autoFocus className="underline-input" type="text" placeholder="e.g. Oxford Union, rowing..." style={{ fontSize: 20, opacity: answers['societies'] === 'none' ? 0.35 : 1 }} disabled={answers['societies'] === 'none'} value={answers['societies'] === 'none' ? '' : (answers['societies'] || '')} onChange={e => updateAnswer('societies', e.target.value)} onKeyDown={e => e.key === 'Enter' && goNext()} />
            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text3)', marginTop: 6 }}>Separate with a comma.</p>
            <div className="tap-card" style={{ marginTop: 12, textAlign: 'center', borderColor: answers['societies'] === 'none' ? 'var(--text)' : 'var(--border2)' }} onClick={() => updateAnswer('societies', answers['societies'] === 'none' ? '' : 'none')}>
              I'm not in any
            </div>
            <div className="ob-spacer"></div>
            <button className="btn-primary" onClick={goNext}>Continue</button>
            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-music' && (
<StepWrapper key="q-music" currentStep={currentStep} id="q-music">
            <h1 className="ob-heading sm">What have you been listening to lately?</h1>
            <p className="ob-subtext">An artist, a genre, or a specific album.</p>
            <p className="ob-whisper" style={{ marginBottom: 20 }}>Music taste is embedded and matched semantically. It is a surprisingly strong signal for personality.</p>
            <input autoFocus className="underline-input" type="text" placeholder="e.g. Kendrick Lamar, ambient techno..." style={{ fontSize: 22 }} value={answers['music'] || ''} onChange={e => updateAnswer('music', e.target.value)} onKeyDown={e => e.key === 'Enter' && goNext()} />
            <div className="ob-spacer"></div>
            <button className="btn-primary" onClick={goNext}>Continue</button>
            <p className="skip-link" onClick={goNext}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'q-friends' && (
<StepWrapper key="q-friends" currentStep={currentStep} id="q-friends">
            <h1 className="ob-heading sm">Add your best friends.</h1>
            <p className="ob-subtext">The people you'd actually want on here with you.</p>
            <p className="ob-whisper" style={{ marginBottom: 24 }}>We'll connect you automatically if they're already here, and give you a link to invite them if not.</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 8 }} id="friend-bubbles">
              {[0, 1, 2].map((idx) => {
                const visual = friendVisuals[idx];
                const isActive = activeFriendPopover === idx;
                const isVerified = visual.state === 'verified';
                const isInvite = visual.state === 'invite';
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
                    <div
                      id={`fb-${idx}`}
                      ref={(node) => { friendBubbleRefs.current[idx] = node; }}
                      onClick={() => openFriendPopover(idx)}
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        border: `1.5px ${isVerified ? 'solid' : 'dashed'} ${isVerified ? 'var(--success)' : 'var(--border2)'}`,
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 4,
                        transition: 'border-color 0.2s, background 0.2s',
                        background: isVerified ? '#F0FDF4' : (isInvite ? '#FAFAF8' : 'var(--bg)'),
                      }}
                    >
                      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 22, height: 22, borderRadius: '50%', background: 'var(--text)', color: '#FFFEFD', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        {idx + 1}
                      </div>
                      {isVerified ? (
                        <>
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M4 11l5 5L18 6" />
                          </svg>
                          <span style={{ fontSize: 10, color: 'var(--text2)', textAlign: 'center', padding: '0 8px', wordBreak: 'break-all', maxWidth: 88, lineHeight: 1.3 }}>{visual.value}</span>
                        </>
                      ) : isInvite ? (
                        <span style={{ fontSize: 10, color: 'var(--text2)', textAlign: 'center', padding: '0 8px', wordBreak: 'break-all', maxWidth: 88, lineHeight: 1.3 }}>{visual.value}</span>
                      ) : (
                        <>
                          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="16" cy="11" r="5" />
                            <path d="M4 28c0-6.627 5.373-12 12-12s12 5.373 12 12" />
                          </svg>
                          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Sans',sans-serif" }}>Add</span>
                        </>
                      )}
                    </div>

                    <div
                      id={`fp-${idx}`}
                      ref={(node) => { friendPopoverRefs.current[idx] = node; }}
                      style={{
                        position: 'absolute',
                        top: 110,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 200,
                        background: 'var(--bg)',
                        border: '1px solid var(--border2)',
                        borderRadius: 14,
                        padding: 14,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        zIndex: 300,
                        display: isActive ? 'block' : 'none',
                      }}
                    >
                      <input
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1.5px solid var(--border-light)', fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'var(--text)', padding: '4px 0', outline: 'none' }}
                        placeholder="Name or Oxford email"
                        autoComplete="off"
                        value={friendInputs[idx]}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFriendInputs((prev) => {
                            const next = [...prev];
                            next[idx] = value;
                            return next;
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            commitFriend(idx, e.currentTarget.value);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => commitFriend(idx, friendInputs[idx] || '')}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: 10,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: '1px solid var(--border2)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        aria-label={`Add friend ${idx + 1}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                          <path d="M7 2v10" />
                          <path d="M2 7h10" />
                        </svg>
                      </button>
                    </div>

                    {isInvite && (
                      <button
                        type="button"
                        onClick={(e) => copyFriendInvite(e.currentTarget)}
                        style={{ border: '1px solid var(--border2)', borderRadius: 999, padding: '4px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 11, cursor: 'pointer', background: 'transparent', color: 'var(--text2)', marginTop: 4 }}
                      >
                        Invite
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ob-spacer"></div>
            <button className="btn-primary" onClick={goNextConditional}>Continue</button>
            <p className="skip-link" onClick={goNextConditional}>Skip for now</p>
          </StepWrapper>
)}

          {currentStep === 'confirm' && (
<StepWrapper key="confirm" currentStep={currentStep} id="confirm">
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,200,66,0.12)', border: '1.5px solid rgba(245,200,66,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
              <svg width="14" height="18" viewBox="0 0 14 18" fill="none"><polygon points="8,0 1,10 7,10 6,18 13,8 7,8" fill="#F5C842"/></svg>
            </div>
            <h1 className="ob-heading em" style={{ fontSize: 52, textAlign: 'center' }}>You're in{firstName ? `, ${firstName}` : ''}.</h1>
            <p className="ob-subtext" style={{ textAlign: 'center' }}>Your profile is now live. Supercharged is already running simulations and finding who you need to meet. Expect your first matches within the hour.</p>
            <div className="ob-spacer"></div>
            <button className="btn-accent" disabled={loading} onClick={handleFinish}>
              {loading ? 'Entering...' : 'Enter Supercharged \u26A1'}
            </button>
          </StepWrapper>
)}

        </AnimatePresence>
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: showEndScreen ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', pointerEvents: 'all' }}>
        <div style={{ textAlign: 'center', maxWidth: 340, padding: 24, animation: 'fadeUp 0.8s var(--ease) both' }}>
          <div style={{ marginBottom: 20 }}><svg width="14" height="18" viewBox="0 0 14 18" fill="none"><polygon points="8,0 1,10 7,10 6,18 13,8 7,8" fill="#F5C842"/></svg></div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 300, fontSize: 44, lineHeight: 1.1, marginBottom: 16 }}>You're in.</h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 32 }}>Your profile is live. Supercharged is finding who you need to meet.</p>
          <div className="spinner"></div>
        </div>
      </div>
    </div>
  );
}
