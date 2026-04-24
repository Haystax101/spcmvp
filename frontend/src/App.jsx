import { useState, useEffect, useRef, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import * as Sentry from '@sentry/react'
import {
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  LogOut,
  Search,
  Home as HomeIcon,
  Inbox as InboxIcon,
  UserCircle
} from 'lucide-react'
import { tables, account, functions, DB_ID, PROFILES_TABLE, DISCOVERY_FUNCTION_ID, ID, Query } from './lib/appwrite'
import { track, captureError, identifyUser, logoutUser } from './lib/tracking'
import SearchScreen from './components/SearchScreen'
import NewOnboarding from './NewOnboarding'
import SuperchargedInbox from './SuperchargedInbox'
import SuperchargedProfile from './supercharged_v18'
import HomeScreen from './HomeScreen'
import { VoltzWallet } from './components/VoltzSystem'
import VoltzOverlay from './components/voltz/VoltzOverlay'

const OXFORD_COLLEGES = [
  'All Souls', 'Balliol', 'Brasenose', 'Christ Church', 'Corpus Christi', 'Exeter', 
  'Green Templeton', 'Harris Manchester', 'Hertford', 'Jesus', 'Keble', 'Kellogg', 
  'Lady Margaret Hall', 'Linacre', 'Lincoln', 'Magdalen', 'Mansfield', 'Merton', 
  'New College', 'Nuffield', 'Oriel', 'Pembroke', "Queen's", 'Reuben', "Regent's Park", 
  'Somerville', "St Anne's", "St Antony's", "St Catherine's", 'St Cross', 'St Edmund Hall', 
  "St Hilda's", "St Hugh's", "St John's", "St Peter's", 'Trinity', 'University', 
  'Wadham', 'Wolfson', 'Worcester', 'Wycliffe Hall'
];

// ─── Topographic Background ──────────────────────────────────────────────────
function TopoBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let lines = []
    let globalPhase = 0
    let lastDraw = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      buildLines()
    }

    const buildLines = () => {
      lines = []
      const count = Math.floor(canvas.height / 10)
      for (let i = 0; i < count; i++) {
        lines.push({
          y: (i / count) * canvas.height,
          amp: 6 + Math.random() * 8,
          freq: 0.004 + Math.random() * 0.003,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    const draw = (ts) => {
      requestAnimationFrame(draw)
      if (ts - lastDraw < 33) return
      lastDraw = ts
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      globalPhase += 0.0003
      ctx.strokeStyle = 'rgba(26, 26, 26, 1)'
      ctx.lineWidth = 0.6
      lines.forEach(l => {
        ctx.beginPath()
        for (let x = 0; x <= canvas.width; x += 4) {
          const y = l.y + Math.sin(x * l.freq + globalPhase + l.phase) * l.amp
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      })
    }

    window.addEventListener('resize', resize)
    resize()
    requestAnimationFrame(draw)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return <canvas id="topo-canvas" ref={canvasRef} />
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
// Removed name state as it's handled in onboarding
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      try {
        await account.deleteSession('current')
      } catch {
        // Ignore if no active session exists.
      }

      if (mode === 'signup') {
        track.signupAttempted()
        const tempName = email.split('@')[0]
        await account.create(ID.unique(), email, password, tempName)
        await account.createEmailPasswordSession(email, password)
        track.signupCompleted()
      } else {
        track.signinAttempted()
        await account.createEmailPasswordSession(email, password)
        track.signinCompleted()
      }
      const user = await account.get()
      onAuth(user)
    } catch (err) {
      const message = err.message || 'Authentication failed'
      setError(message)
      captureError(err, { context: 'auth_submit', mode })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <TopoBackground />
      <Motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-border-light relative z-10"
      >
        <div className="flex justify-center mb-10">
          <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-2xl">
            ⚡
          </div>
        </div>

        <h1 className="font-playfair text-4xl text-center mb-2 font-light tracking-tight">
          {mode === 'signup' ? 'Join the network' : 'Welcome back'}
        </h1>
        <p className="text-center text-text2 text-sm mb-10 font-sans">
          {mode === 'signup' ? 'Oxford University students only · Verified by email' : 'Sign in to see your matches'}
        </p>

        {error && (
          <Motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-50 border border-red-100 text-xs text-error font-medium"
          >
            {error}
          </Motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="relative">
            <input
              type="email" required value={email} placeholder="you@ox.ac.uk"
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-border-light py-3 font-playfair text-2xl focus:border-text focus:outline-none transition-colors placeholder:text-text3"
            />
          </div>
          <div className="relative">
            <input
              type="password" required value={password} placeholder="Password"
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-border-light py-3 font-playfair text-2xl focus:border-text focus:outline-none transition-colors placeholder:text-text3"
            />
          </div>

          <div className="pt-6">
            <button
              type="submit" disabled={loading}
              className="w-full bg-text text-white py-5 rounded-full text-sm font-semibold tracking-wide hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {loading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full mx-auto" /> : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-12 text-center text-sm text-text2 underline-offset-4">
          {mode === 'signup' ? 'Already have an account?' : 'No account yet?'}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }}
            className="ml-2 text-text font-semibold hover:underline"
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </div>
      </Motion.div>
    </div>
  )
}

// ─── Helper Components ────────────────────────────────────────────────────────

const StepContainer = ({ children, title, subtitle, onBack, onNext, nextDisabled, isFirst, isLast, loading, stepIdx, totalSteps }) => (
  <Motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 relative z-10"
  >
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border-light bg-bg/96 px-6 py-8 sm:px-10 sm:py-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] backdrop-blur-sm">
    <div className="mb-8 flex items-center justify-between">
      {!isFirst ? (
        <button onClick={onBack} className="p-2 -ml-2 text-text3 hover:text-text transition-colors cursor-pointer">
          <ChevronLeft size={24} />
        </button>
      ) : <div />}
      <div className="flex gap-1.5 px-4">
        {[...Array(totalSteps)].map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= stepIdx ? 'w-6 bg-text' : 'w-2 bg-border-light'}`} />
        ))}
      </div>
      <div className="w-8" />
    </div>

    <h2 className="font-playfair text-3xl sm:text-4xl mb-3 font-light leading-tight">{title}</h2>
    {subtitle && <p className="text-text2 text-base sm:text-lg mb-8 font-sans leading-relaxed">{subtitle}</p>}
    
    <div className="min-h-[200px] relative z-10">
      {children}
    </div>

    <div className="mt-12 flex justify-end relative z-20">
      <button
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="group flex items-center gap-3 bg-text text-white px-9 py-4 rounded-full text-sm font-semibold hover:opacity-85 transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.98] cursor-pointer"
      >
        {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : isLast ? 'Complete Profile' : 'Next'}
        {!loading && !isLast && <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />}
      </button>
    </div>
    </div>
  </Motion.div>
)

const Chip = ({ label, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`px-5 py-2.5 rounded-full border text-sm transition-all duration-300 ${
      selected 
        ? 'bg-text text-white border-text' 
        : 'bg-white text-text border-border-light hover:border-text3'
    }`}
  >
    {label}
  </button>
)

const RankCard = ({ label, rank, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full p-5 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between ${
      rank 
        ? 'border-accent bg-accent/5 ring-1 ring-accent' 
        : 'border-border-light hover:border-text3 bg-white'
    }`}
  >
    <span className="font-medium">{label}</span>
    {rank && (
      <div className="w-6 h-6 rounded-full bg-accent text-text text-[10px] font-bold flex items-center justify-center">
        {rank}
      </div>
    )}
  </button>
)

// ─── Onboarding Flow ──────────────────────────────────────────────────────────

function OnboardingScreen({ user, onComplete }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [docId, setDocId] = useState(null)
  const [_cvSkipped, setCvSkipped] = useState(false)
  const [rank1Category, setRank1Category] = useState('')
  const [collegeSearch, setCollegeSearch] = useState('')
  const [formData, setFormData] = useState({
    email: user.email || '',
    first_name: user.name.split(' ')[0],
    last_name: user.name.split(' ')[1] || '',
    birthday_at: '',
    birthday_day: '',
    birthday_month: '',
    birthday_year: '',
    username: '',
    college: '',
    study_subject: '',
    year_of_study: '',
    career_field: '',
    career_subfield: '',
    building_description: '',
    goals: [],
    desired_connections: [],
    startup_connections: [],
    social_circles: [],
    friendship_values: [],
    intellectual_identity: '',
    intellectual_venue: '',
    intellectual_ambition: '',
    wish_studied: '',
    study_wish: '',
    work_style: '',
    project_stage: '',
    relationship_intent: '',
    relationship_status: '',
    sexuality: '',
    dating_appearance: [],
    dating_personality: [],
    dating_hobbies: [],
    hobby: '',
    music: '',
    societies: '',
    networking_style: '',
    honest_thing: '',
    social_energy: 3,
    friend_references: [],
    friend_references_raw: '', // Added to handle smooth typing with spaces
    cv_file_id: '',
    cv_parsed_text: '',
    cv_indexed: false,
    is_onboarding_complete: false
  })

  const buildFullName = (data) => {
    const full = `${data.first_name || ''} ${data.last_name || ''}`.trim()
    return full || user.name || user.email || ''
  }

  const inferPrimaryIntent = (data) => {
    const goals = Array.isArray(data.goals) ? data.goals : []
    if (goals.length > 0) {
      const firstGoal = goals[0].toLowerCase()
      if (/date|romantic|relationship/.test(firstGoal)) return 'romantic'
      if (/friend|social|network/.test(firstGoal)) return 'social'
      if (/study|academic|research|intellectual/.test(firstGoal)) return 'academic'
      return 'professional'
    }

    const desired = Array.isArray(data.desired_connections) ? data.desired_connections.join(' ').toLowerCase() : ''
    if (/romantic|partner|date/.test(desired)) return 'romantic'
    if (/friend|social/.test(desired)) return 'social'
    if (/study|academic|research/.test(desired)) return 'academic'
    return 'professional'
  }

  const buildBirthdayAt = (data) => {
    if (data.birthday_at) return data.birthday_at

    const day = Number.parseInt(data.birthday_day || '', 10)
    const month = Number.parseInt(data.birthday_month || '', 10)
    const year = Number.parseInt(data.birthday_year || '', 10)

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return ''

    const parsed = new Date(Date.UTC(year, month - 1, day))
    const isValid = (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    )

    return isValid ? parsed.toISOString() : ''
  }

  const getBirthdayValidation = (data) => {
    const day = Number.parseInt(data.birthday_day || '', 10)
    const month = Number.parseInt(data.birthday_month || '', 10)
    const year = Number.parseInt(data.birthday_year || '', 10)

    if (!data.birthday_day || !data.birthday_month || !data.birthday_year) {
      return { valid: false, error: '' }
    }

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return { valid: false, error: 'Enter a valid date.' }
    }

    const parsed = new Date(Date.UTC(year, month - 1, day))
    const isValidDate = (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    )

    if (!isValidDate) {
      return { valid: false, error: 'Enter a valid date.' }
    }

    const now = new Date()
    let age = now.getUTCFullYear() - year
    const hasHadBirthdayThisYear = (
      now.getUTCMonth() + 1 > month ||
      (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day)
    )
    if (!hasHadBirthdayThisYear) age -= 1

    if (age < 18) {
      return { valid: false, error: 'You must be 18 or over to join.' }
    }

    return { valid: true, error: '' }
  }

  const buildPrimaryIntent = (data) => {
    return rank1Category || inferPrimaryIntent(data)
  }

  const buildFreeTextResponses = (data) => {
    const extras = {
      birthday_at: buildBirthdayAt(data),
      birthday_day: data.birthday_day || '',
      birthday_month: data.birthday_month || '',
      birthday_year: data.birthday_year || '',
      username: data.username || '',
      study_subject: data.study_subject || '',
      year_of_study: data.year_of_study || '',
      career_subfield: data.career_subfield || '',
      building_description: data.building_description || '',
      study_wish: data.study_wish || '',
      relationship_status: data.relationship_status || '',
      sexuality: data.sexuality || '',
      dating_appearance: Array.isArray(data.dating_appearance) ? data.dating_appearance : [],
      dating_personality: Array.isArray(data.dating_personality) ? data.dating_personality : [],
      dating_hobbies: Array.isArray(data.dating_hobbies) ? data.dating_hobbies : [],
      hobby: data.hobby || '',
      music: data.music || '',
      societies: data.societies || '',
      intellectual_venue: data.intellectual_venue || '',
      intellectual_ambition: data.intellectual_ambition || '',
      startup_connections: Array.isArray(data.startup_connections) ? data.startup_connections : []
    }

    const compact = JSON.stringify(extras)
    return compact.length > 10000 ? compact.slice(0, 9997) + '...' : compact
  }

  // Build one canonical payload so every row write consistently satisfies schema requirements.
  const buildProfilePayload = (data) => {
    const birthdayAt = buildBirthdayAt(data)

    return {
      user_id: user.$id,
      full_name: buildFullName(data),
      primary_intent: buildPrimaryIntent(data),
      email: data.email || user.email || '',
      first_name: (data.first_name || '').trim(),
      last_name: (data.last_name || '').trim(),
      ...(birthdayAt ? { birthday_at: birthdayAt } : {}),
      birthday_day: data.birthday_day || '',
      birthday_month: data.birthday_month || '',
      birthday_year: data.birthday_year || '',
      username: data.username || '',
      college: data.college || '',
      study_subject: data.study_subject || '',
      year_of_study: data.year_of_study || '',
      course: data.course || data.study_subject || '',
      stage: data.stage || data.year_of_study || '',
      career_subfield: data.career_subfield || '',
      building_description: data.building_description || '',
      free_text_responses: buildFreeTextResponses(data),
      cv_file_id: data.cv_file_id || '',
      cv_parsed_text: data.cv_parsed_text || '',
      cv_indexed: Boolean(data.cv_indexed),
      goals: Array.isArray(data.goals) ? data.goals : [],
      career_field: data.career_field || '',
      desired_connections: Array.isArray(data.desired_connections) ? data.desired_connections : [],
      startup_connections: Array.isArray(data.startup_connections) ? data.startup_connections : [],
      networking_style: data.networking_style || '',
      social_circles: Array.isArray(data.social_circles) ? data.social_circles : [],
      friendship_values: Array.isArray(data.friendship_values) ? data.friendship_values : [],
      intellectual_identity: data.intellectual_identity || '',
      intellectual_venue: data.intellectual_venue || '',
      intellectual_ambition: data.intellectual_ambition || '',
      wish_studied: data.wish_studied || '',
      study_wish: data.study_wish || '',
      work_style: data.work_style || '',
      project_stage: data.project_stage || '',
      relationship_intent: data.relationship_intent || '',
      relationship_status: data.relationship_status || '',
      sexuality: data.sexuality || '',
      dating_appearance: Array.isArray(data.dating_appearance) ? data.dating_appearance : [],
      dating_personality: Array.isArray(data.dating_personality) ? data.dating_personality : [],
      dating_hobbies: Array.isArray(data.dating_hobbies) ? data.dating_hobbies : [],
      hobby: data.hobby || '',
      music: data.music || '',
      societies: data.societies || '',
      social_energy: Number.isInteger(data.social_energy) ? data.social_energy : 3,
      honest_thing: data.honest_thing || '',
      friend_references: Array.isArray(data.friend_references) ? data.friend_references : [],
      is_onboarding_complete: Boolean(data.is_onboarding_complete),
      is_indexed: Boolean(data.is_indexed)
    }
  }

  const buildStepOrder = () => {
    const fixedPre = ['first-name', 'last-name', 'birthday', 'username', 'cv', 'college', 'study', 'year', 'interstitial', 'goals']
    const sharedPostGoals = ['career', 'connections']
    const branchByIntent = {
      professional: ['career-subfield', 'networking-style', 'work', 'project', 'social-life', 'values'],
      social: ['social-life', 'values'],
      academic: ['intellect', 'wish', 'intellectual-ambition', 'intellectual-venue'],
      romantic: ['dating', 'relationship-status', 'sexuality', 'dating-appearance', 'dating-personality', 'dating-hobbies']
    }
    const sharedTail = ['truth', 'energy', 'referral']

    const activeIntent = rank1Category || inferPrimaryIntent(formData)
    const branch = branchByIntent[activeIntent] || branchByIntent.professional

    return [...fixedPre, ...sharedPostGoals, ...branch, ...sharedTail]
  }

  const steps = buildStepOrder()
  const currentStep = steps[step]
  const birthdayValidation = getBirthdayValidation(formData)

  const handleNext = async () => {
    setLoading(true)
    try {
      if (currentStep === 'goals') {
        setRank1Category(inferPrimaryIntent(formData))
      }

      let nextRowId = docId

      // Create or update profile row in Appwrite tables
      if (!docId) {
        const row = await tables.createRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: ID.unique(),
          data: buildProfilePayload({
            ...formData,
            is_onboarding_complete: false,
            is_indexed: false
          })
        })
        nextRowId = row.$id
        setDocId(row.$id)
      } else {
        await tables.updateRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: docId,
          data: buildProfilePayload(formData)
        })
      }

      if (step === steps.length - 1) {
        // Final Step: mark complete
        await tables.updateRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: nextRowId,
          data: buildProfilePayload({
            ...formData,
            is_onboarding_complete: true
          })
        })
        onComplete(nextRowId)
      } else {
        setStep(s => s + 1)
      }
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))
  const toggle = (field, value) => {
    const arr = formData[field]
    if (arr.includes(value)) update(field, arr.filter(v => v !== value))
    else update(field, [...arr, value])
  }
  const toggleRank = (field, value, max = 3) => {
    const arr = formData[field]
    if (arr.includes(value)) update(field, arr.filter(v => v !== value))
    else if (arr.length < max) update(field, [...arr, value])
  }

  const toggleLimited = (field, value, max = 5) => {
    const arr = Array.isArray(formData[field]) ? formData[field] : []
    if (arr.includes(value)) {
      update(field, arr.filter(v => v !== value))
      return
    }
    if (arr.length >= max) return
    update(field, [...arr, value])
  }

  const filteredColleges = OXFORD_COLLEGES.filter(c => 
    c.toLowerCase().includes(collegeSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg relative overflow-y-auto flex flex-col justify-center">
      <TopoBackground />
      <AnimatePresence mode="wait">
        
        {steps[step] === 'first-name' && (
          <StepContainer 
            key="first-name" title="What's your first name?" subtitle="So your matches know who they're talking to."
            isFirst onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.first_name.trim()}
            totalSteps={steps.length}
          >
            <input 
              autoFocus placeholder="First name" value={formData.first_name}
              onChange={e => update('first_name', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-4xl sm:text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'last-name' && (
          <StepContainer 
            key="last-name" title="And your last name?" subtitle="Only revealed after a match is made."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.last_name.trim()}
            totalSteps={steps.length}
          >
            <input 
              autoFocus placeholder="Last name" value={formData.last_name}
              onChange={e => update('last_name', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-4xl sm:text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'birthday' && (
          <StepContainer
            key="birthday" title="When's your birthday?" subtitle="Used to verify you are 18 or over and to surface age-appropriate matches."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!birthdayValidation.valid}
            totalSteps={steps.length}
          >
            <div className="grid grid-cols-3 gap-3">
              <input className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl text-center focus:border-accent transition-colors focus:outline-none placeholder:text-text3" placeholder="DD" inputMode="numeric" maxLength={2} value={formData.birthday_day} onChange={e => update('birthday_day', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              <input className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl text-center focus:border-accent transition-colors focus:outline-none placeholder:text-text3" placeholder="MM" inputMode="numeric" maxLength={2} value={formData.birthday_month} onChange={e => update('birthday_month', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              <input className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl text-center focus:border-accent transition-colors focus:outline-none placeholder:text-text3" placeholder="YYYY" inputMode="numeric" maxLength={4} value={formData.birthday_year} onChange={e => update('birthday_year', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
            {birthdayValidation.error && (
              <p className="mt-4 text-sm text-error">{birthdayValidation.error}</p>
            )}
          </StepContainer>
        )}

        {steps[step] === 'username' && (
          <StepContainer
            key="username" title="Choose your username." subtitle="This is your handle on Supercharged. You can change it later."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={formData.username.trim().length < 3}
            totalSteps={steps.length}
          >
            <div className="flex items-end gap-2">
              <span className="font-dm-sans text-lg text-text3 pb-4">@</span>
              <input className="flex-1 bg-transparent border-b border-border py-4 font-playfair text-3xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3" placeholder="username" value={formData.username} onChange={e => update('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))} />
            </div>
          </StepContainer>
        )}

        {steps[step] === 'cv' && (
          <StepContainer
            key="cv" title="Show us your trajectory." subtitle="Upload your CV or personal statement if you have one."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <div className="upload-zone" id="cv-zone" onClick={() => document.getElementById('cv-file-input')?.click()} onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }} onDragLeave={e => e.currentTarget.classList.remove('drag-over')} onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const file = e.dataTransfer.files[0]; if (file) { if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB.'); return } update('cv_file_id', file.name); update('cv_indexed', false); } }}>
              <input type="file" id="cv-file-input" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB.'); return } update('cv_file_id', file.name); update('cv_indexed', false); }} />
              <div className="upload-zone-inner">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 20V10"/><path d="M9 15l5-5 5 5"/><path d="M6 22h16"/></svg>
                <p style={{ fontSize: '14px', color: 'var(--text2)', marginTop: '12px' }}>Drag a file here or tap to browse</p>
                <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>PDF, Word, or plain text · Max 5MB</p>
              </div>
            </div>
            <p className="skip-link" onClick={() => { setCvSkipped(true); setStep(s => s + 1) }}>Skip for now</p>
          </StepContainer>
        )}

        {steps[step] === 'study' && (
          <StepContainer
            key="study" title="What do you study?" subtitle="Helps us match you with people in adjacent or complementary fields."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.study_subject.trim()}
            totalSteps={steps.length}
          >
            <input autoFocus className="w-full bg-transparent border-b border-border py-4 font-playfair text-4xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3" placeholder="e.g. PPE, Computer Science, Law" value={formData.study_subject} onChange={e => update('study_subject', e.target.value)} />
          </StepContainer>
        )}

        {steps[step] === 'year' && (
          <StepContainer
            key="year" title="Which year are you in?" subtitle="Helps us calibrate the kind of connections that make sense for where you are right now."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.year_of_study}
            totalSteps={steps.length}
          >
            <div className="tap-cards">
              {['First year','Second year','Third year','Fourth year or above','Postgraduate'].map(y => (
                <button key={y} type="button" className={`tap-card ${formData.year_of_study === y ? 'selected' : ''}`} onClick={() => update('year_of_study', y)}>{y}</button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'interstitial' && (
          <StepContainer
            key="interstitial" title="" subtitle={null}
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step} totalSteps={steps.length}
          >
            <div className="mb-12 max-w-md">
              <h2 className="font-playfair text-4xl mb-4 font-light leading-tight">We build a high-fidelity model of your world.</h2>
              <p className="text-text2 text-lg leading-relaxed">
                Supercharged uses embedding vectors to simulate how your personality, goals, and interests interact with thousands of others at Oxford.
              </p>
            </div>
            <div className="flow-diagram" style={{ marginTop: '0' }}>
              <div className="flow-node"><div className="flow-circle">👤</div><div className="flow-label">Your profile</div></div>
              <div className="flow-arrow">→</div>
              <div className="flow-node"><div className="flow-circle" style={{ borderColor: 'var(--accent)', background: 'rgba(245,200,66,0.08)' }}>⚡</div><div className="flow-label">Simulate</div></div>
              <div className="flow-arrow">→</div>
              <div className="flow-node"><div className="flow-circle">🤝</div><div className="flow-label">Top matches</div></div>
            </div>
          </StepContainer>
        )}

        {steps[step] === 'college' && (
          <StepContainer 
            key="college" title="Which college are you at?" subtitle="Helps us surface connections across colleges, not just your own bubble." 
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.college}
            totalSteps={steps.length}
          >
            <div className="relative mb-6">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-text3" size={20} />
              <input 
                autoFocus placeholder="Search colleges..." value={collegeSearch}
                onChange={e => setCollegeSearch(e.target.value)}
                className="w-full bg-transparent border-b border-border py-4 pl-8 font-dm-sans text-xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
              />
            </div>
            <div className="flex flex-wrap gap-2 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredColleges.map(c => (
                <button
                  key={c}
                  onClick={() => update('college', c)}
                  className={`px-5 py-2.5 rounded-full border text-sm transition-all duration-300 ${
                    formData.college === c 
                      ? 'bg-text text-white border-text' 
                      : 'bg-white text-text border-border-light hover:border-text3'
                  }`}
                >
                  {c}
                </button>
              ))}
              {filteredColleges.length === 0 && (
                <p className="text-text3 italic text-sm py-4">No colleges found matching "{collegeSearch}"</p>
              )}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'goals' && (
          <StepContainer 
            key="goals" title="What describes you best?" subtitle="Select all that apply."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={formData.goals.length === 0}
            totalSteps={steps.length}
          >
            <div className="flex flex-wrap gap-3">
              {[
                "I'm building a startup", "I'm looking for a co-founder", "I want to fundraise", 
                "I'm a researcher", "I'm looking for a job", "I'm looking for deep friendships",
                "I'm looking for intellectual sparring", "I'm looking for a date"
              ].map(g => (
                <Chip key={g} label={g} selected={formData.goals.includes(g)} onClick={() => toggle('goals', g)} />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'career' && (
          <StepContainer 
            key="career" title="What's your career field?" subtitle="Or what you're aspiring to be."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.career_field}
            totalSteps={steps.length}
          >
            <div className="flex flex-wrap gap-3">
              {["Tech & AI", "Finance", "Consulting", "Research & Academia", "Medicine", "Law", "Arts & Creative", "Public Policy"].map(c => (
                <Chip key={c} label={c} selected={formData.career_field === c} onClick={() => update('career_field', c)} />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'career-subfield' && (
          <StepContainer
            key="career-subfield" title="Where in that field?" subtitle="A little specificity improves your matches."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={formData.career_subfield.trim().length < 2}
            totalSteps={steps.length}
          >
            <input
              autoFocus placeholder="e.g. AI safety, venture capital, policy design" value={formData.career_subfield}
              onChange={e => update('career_subfield', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-4xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'networking-style' && (
          <StepContainer
            key="networking-style" title="How do you network best?" subtitle="We use this to surface compatible connection styles."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.networking_style}
            totalSteps={steps.length}
          >
            <div className="tap-cards">
              {[
                'I actively reach out to new people',
                'I prefer warm introductions',
                'I am selective and deliberate',
                'I let things happen organically'
              ].map(style => (
                <button
                  key={style}
                  type="button"
                  className={`tap-card ${formData.networking_style === style ? 'selected' : ''}`}
                  onClick={() => update('networking_style', style)}
                >
                  {style}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'connections' && (
          <StepContainer 
            key="connections" title="Who are you looking to connect with?" subtitle="Select your top 3."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <div className="space-y-3">
              {["Co-founders", "Mentors", "Investors", "Study buddies", "Drinking partners", "Romantic partners", "Deep thinkers"].map(c => (
                <RankCard key={c} label={c} rank={formData.desired_connections.indexOf(c) + 1 || null} onClick={() => toggleRank('desired_connections', c)} />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'social-life' && (
          <StepContainer 
            key="social-life" title="What's your Oxford social life like?" subtitle="Which circles do you move in?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <div className="flex flex-wrap gap-3">
              {["Union", "Varsity Sports", "College Rowing", "Subject Societies", "Politics", "Nights out", "Pub culture"].map(s => (
                <Chip key={s} label={s} selected={formData.social_circles.includes(s)} onClick={() => toggle('social_circles', s)} />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'values' && (
          <StepContainer 
            key="values" title="What do you value in friends?" subtitle="Select your top 3."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <div className="space-y-3">
              {["Loyalty", "Ambition", "Intellectual curiosity", "Humour", "Honesty", "Emotional intelligence"].map(v => (
                <RankCard key={v} label={v} rank={formData.friendship_values.indexOf(v) + 1 || null} onClick={() => toggleRank('friendship_values', v)} />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'intellect' && (
          <StepContainer 
            key="intellect" title="How do you see yourself intellectually?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <div className="space-y-3">
              {[
                "Deep specialist — I go very far in one thing",
                "Generalist — I connect ideas across fields",
                "Contrarian — I question received wisdom",
                "Practitioner — I care about what works",
                "Explorer — I follow curiosity wherever it leads"
              ].map(i => (
                <button
                  key={i} onClick={() => update('intellectual_identity', i)}
                  className={`w-full p-5 rounded-2xl border text-left transition-all ${formData.intellectual_identity === i ? 'border-text bg-text/5' : 'border-border-light'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'wish' && (
          <StepContainer 
            key="wish" title="If you could study anything else..." subtitle="What would it be?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <input 
              autoFocus placeholder="Ex. Astrophysics or Fine Art" value={formData.wish_studied}
              onChange={e => update('wish_studied', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'intellectual-ambition' && (
          <StepContainer
            key="intellectual-ambition" title="What do you want to do with your intellectual life?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.intellectual_ambition}
            totalSteps={steps.length}
          >
            <div className="tap-cards">
              {[
                'Apply it in the real world',
                'Create with it',
                'Change systems with it',
                'Still figuring it out'
              ].map(option => (
                <button
                  key={option}
                  type="button"
                  className={`tap-card ${formData.intellectual_ambition === option ? 'selected' : ''}`}
                  onClick={() => update('intellectual_ambition', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'intellectual-venue' && (
          <StepContainer
            key="intellectual-venue" title="Where do your best conversations happen?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.intellectual_venue}
            totalSteps={steps.length}
          >
            <div className="tap-cards">
              {[
                'Tutorials and seminars',
                'Society talks and panels',
                'One-on-one conversations',
                'Over dinner',
                'I am still looking for them'
              ].map(option => (
                <button
                  key={option}
                  type="button"
                  className={`tap-card ${formData.intellectual_venue === option ? 'selected' : ''}`}
                  onClick={() => update('intellectual_venue', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'work' && (
          <StepContainer 
            key="work" title="How do you work best?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
             <div className="space-y-3">
              {["Early bird", "Night owl", "Deep work blocks", "Collaborative & chatty"].map(w => (
                <button
                  key={w} onClick={() => update('work_style', w)}
                  className={`w-full p-5 rounded-2xl border text-left transition-all ${formData.work_style === w ? 'border-text bg-text/5' : 'border-border-light'}`}
                >
                  {w}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'project' && (
          <StepContainer 
            key="project" title="What stage is your project at?" subtitle="If applicable."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
             <div className="space-y-3">
              {["Ideation", "MVP built", "Early traction", "Scaling", "Just curious"].map(p => (
                <button
                  key={p} onClick={() => update('project_stage', p)}
                  className={`w-full p-5 rounded-2xl border text-left transition-all ${formData.project_stage === p ? 'border-text bg-text/5' : 'border-border-light'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'dating' && (
          <StepContainer 
            key="dating" title="What's your relationship intent?" subtitle="Only shown to others with dating goals."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.relationship_intent}
            totalSteps={steps.length}
          >
            <div className="space-y-3">
              {["Long-term relationship", "Short-term fun", "Figuring it out", "Casual dating"].map(d => (
                <button
                  key={d} onClick={() => update('relationship_intent', d)}
                  className={`w-full p-5 rounded-2xl border text-left transition-all ${formData.relationship_intent === d ? 'border-text bg-text/5' : 'border-border-light'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'relationship-status' && (
          <StepContainer
            key="relationship-status" title="Where are you right now?" subtitle="This helps us set expectations correctly."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.relationship_status}
            totalSteps={steps.length}
          >
            <div className="tap-cards">
              {['Single', 'In a relationship', 'It is complicated', 'Prefer not to say'].map(option => (
                <button
                  key={option}
                  type="button"
                  className={`tap-card ${formData.relationship_status === option ? 'selected' : ''}`}
                  onClick={() => update('relationship_status', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'sexuality' && (
          <StepContainer
            key="sexuality" title="How do you identify?" subtitle="This is private and used only for matching relevance."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={!formData.sexuality}
            totalSteps={steps.length}
          >
            <div className="tap-cards">
              {['Straight', 'Gay or lesbian', 'Bisexual', 'Pansexual', 'Prefer not to say'].map(option => (
                <button
                  key={option}
                  type="button"
                  className={`tap-card ${formData.sexuality === option ? 'selected' : ''}`}
                  onClick={() => update('sexuality', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'dating-appearance' && (
          <StepContainer
            key="dating-appearance" title="What draws you in physically?" subtitle="Select what resonates most."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={formData.dating_appearance.length === 0}
            totalSteps={steps.length}
          >
            <div className="flex flex-wrap gap-3">
              {['Well-dressed', 'Natural look', 'Athletic build', 'Alternative style', 'No strong preference'].map(option => (
                <Chip
                  key={option}
                  label={option}
                  selected={formData.dating_appearance.includes(option)}
                  onClick={() => toggle('dating_appearance', option)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'dating-personality' && (
          <StepContainer
            key="dating-personality" title="What do you value most in a partner?" subtitle="Pick up to five."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={formData.dating_personality.length === 0}
            totalSteps={steps.length}
          >
            <div className="flex flex-wrap gap-3">
              {['Ambition', 'Humour', 'Emotional depth', 'Kindness', 'Curiosity', 'Confidence', 'Warmth'].map(option => (
                <Chip
                  key={option}
                  label={option}
                  selected={formData.dating_personality.includes(option)}
                  onClick={() => toggleLimited('dating_personality', option, 5)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'dating-hobbies' && (
          <StepContainer
            key="dating-hobbies" title="What would you want to do together?" subtitle="Choose as many as fit your lifestyle."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            nextDisabled={formData.dating_hobbies.length === 0}
            totalSteps={steps.length}
          >
            <div className="flex flex-wrap gap-3">
              {['Coffee and long conversations', 'Travel', 'Music gigs', 'Fitness', 'Films', 'Creative projects'].map(option => (
                <Chip
                  key={option}
                  label={option}
                  selected={formData.dating_hobbies.includes(option)}
                  onClick={() => toggle('dating_hobbies', option)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'truth' && (
          <StepContainer 
            key="truth" title="What's one thing people don't realise?" subtitle="The most honest thing about you."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <input 
              autoFocus placeholder="Be brave..." value={formData.honest_thing}
              onChange={e => update('honest_thing', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'energy' && (
          <StepContainer 
            key="energy" title="How much social energy do you have?" 
            subtitle="Are you a quiet observer or the life of the party?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
            totalSteps={steps.length}
          >
            <div className="space-y-8">
              <input 
                type="range" min="1" max="5" value={formData.social_energy}
                onChange={e => update('social_energy', parseInt(e.target.value))}
                className="w-full h-2 bg-border-light rounded-lg appearance-none cursor-pointer accent-text"
              />
              <div className="flex justify-between text-xs font-mono uppercase tracking-widest text-text3">
                <span>Quiet Observer</span>
                <span>The Life of the Party</span>
              </div>
            </div>
          </StepContainer>
        )}

        {steps[step] === 'referral' && (
          <StepContainer 
            key="referral" title="Who should we know?" subtitle="Names or roles of people you'd recommend."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} isLast stepIdx={step}
            totalSteps={steps.length}
          >
            <input 
              autoFocus placeholder="Ex. David at Balliol, or anyone in the rowing team..." 
              value={formData.friend_references_raw || formData.friend_references.join(', ')}
              onChange={e => {
                const val = e.target.value;
                update('friend_references_raw', val);
                update('friend_references', val.split(',').map(s => s.trim()).filter(Boolean));
              }}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

      </AnimatePresence>
    </div>
  )
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen({ docId, onReady }) {
  useEffect(() => {
    if (!docId) return
    const interval = setInterval(async () => {
      try {
        const doc = await tables.getRow({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          rowId: docId
        })
        if (doc.is_indexed) {
          clearInterval(interval)
          onReady(doc)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [docId, onReady])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-bg">
      <TopoBackground />
      <div className="text-center relative z-10">
        <Motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-8"
        >
          ✨
        </Motion.div>
        <h3 className="font-playfair text-3xl mb-4 font-light tracking-tight">Vectorizing your personality...</h3>
        <p className="text-text2 text-sm max-w-xs mx-auto leading-relaxed">
          Gemini 3.1 is embedding your responses into 1,536-dimensional space to find your best matches.
        </p>
      </div>
    </div>
  )
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, rank }) {
  return (
    <Motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="bg-white border border-border-light p-8 group hover:border-text transition-all duration-500 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4">
        <div className="text-right">
          <div className="text-3xl font-playfair font-light">{match.score}%</div>
          <div className="text-[10px] uppercase tracking-widest text-text3 font-bold">Match Score</div>
        </div>
      </div>

      <div className="max-w-[80%]">
        <h3 className="font-playfair text-2xl mb-1 group-hover:underline decoration-accent underline-offset-4">{match.full_name}</h3>
        <p className="text-text2 text-sm mb-6 flex items-center gap-2">
          <span className="font-semibold text-text">{match.college}</span>
          <span className="w-1 h-1 rounded-full bg-border-light" />
          <span>{match.career_field || 'Student'}</span>
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {(match.goals || []).slice(0, 3).map(g => (
            <span key={g} className="text-[10px] uppercase tracking-tighter border border-border-light px-2 py-1 rounded bg-bg group-hover:border-text/20 transition-colors">
              {g}
            </span>
          ))}
        </div>

        <p className="text-[11px] text-text3 mb-5 font-mono uppercase tracking-wider">
          Semantic {match.semantic_pct ?? 0}% • Intent {match.intent_pct ?? 0}%{typeof match.structured_score === 'number' ? ` • Structured ${match.structured_score}%` : ''}
        </p>

        {Array.isArray(match.score_breakdown?.details) && match.score_breakdown.details.length > 0 && (
          <p className="text-[11px] text-text3 mb-4 font-mono leading-relaxed">
            {match.score_breakdown.details.join(' · ')}
          </p>
        )}

        {match.match_reason && (
          <p className="text-sm text-text2 mb-6 leading-relaxed">
            {match.match_reason}
          </p>
        )}

        {match.honest_thing && (
          <div className="relative">
             <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-accent/30" />
             <p className="text-sm italic text-text2 leading-relaxed">
               "{match.honest_thing.substring(0, 120)}..."
             </p>
          </div>
        )}
      </div>
    </Motion.div>
  )
}

// ─── Main App Navigation ─────────────────────────────────────────────────────────
function MainApp({ profile: initialProfile, onProfileUpdate, user }) {
  const [profile, setProfile] = useState(initialProfile)
  const [activeScreen, setActiveScreen] = useState('home')
  const [showVoltzModal, setShowVoltzModal] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(null)

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile)
    if (onProfileUpdate) onProfileUpdate(updatedProfile)
  }

  // Verify any pending Stripe payment on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('payment')) return
    window.history.replaceState({}, '', window.location.pathname)
    const sessionId = localStorage.getItem('sc_pending_stripe_session')
    if (!sessionId || !profile) return
    localStorage.removeItem('sc_pending_stripe_session')
    ;(async () => {
      try {
        const execution = await functions.createExecution(
          'stripeGateway',
          JSON.stringify({ action: 'verify_session', session_id: sessionId }),
          false
        )
        const data = JSON.parse(execution.responseBody || '{}')
        if (data.verified && (data.credited || data.already_credited) && typeof data.current_voltz === 'number') {
          const updatedProfile = { ...profile, current_voltz: data.current_voltz }
          handleProfileUpdate(updatedProfile)
          setPendingConfirmation({
            type: 'voltz',
            packageName: data.package || 'purchase',
            voltzAdded: data.amount || 0,
            bonusVoltz: Math.floor((data.amount || 0) * 0.05),
            baseVoltz: data.amount || 0,
            newBalance: data.current_voltz,
          })
          setShowVoltzModal(true)
        }
      } catch (err) {
        console.warn('Payment verification failed:', err)
        captureError(err, { context: 'payment_verification_on_return' })
      }
    })()
  }, [])

  const navItems = [
    { key: 'home', label: 'Home', Icon: HomeIcon },
    { key: 'inbox', label: 'Inbox', Icon: InboxIcon },
    { key: 'profile', label: 'Profile', Icon: UserCircle }
  ]

  return (
    <div
      className="h-[100dvh] relative overflow-hidden bg-bg"
      style={{ '--sc-nav-clearance': 'calc(env(safe-area-inset-bottom, 0px) + 112px)' }}
    >
      {activeScreen === 'home' && (
        <div className="h-full min-h-0 box-border" style={{ paddingBottom: 'var(--sc-nav-clearance)' }}>
          <HomeScreen
            profile={profile}
            onNavigateToInbox={() => setActiveScreen('inbox')}
            onNavigateToSearch={() => setActiveScreen('search')}
            voltzBalance={profile?.current_voltz ?? 0}
            onOpenVoltzModal={() => setShowVoltzModal(true)}
          />
        </div>
      )}
      {activeScreen === 'search' && (
        <div className="h-full min-h-0 box-border bg-bg" style={{ paddingBottom: 'var(--sc-nav-clearance)', zIndex: 100, position: 'relative' }}>
          <SearchScreen 
            profile={profile} 
            onClose={() => setActiveScreen('home')} 
            onConnect={(p) => { 
               // Pass to HomeScreen somehow or implement internally, for now navigating to inbox
               setActiveScreen('inbox')
            }}
            onCompatTap={(p, kind) => {}}
          />
        </div>
      )}
      {activeScreen === 'inbox' && <div className="h-full min-h-0 box-border" style={{ paddingBottom: 'var(--sc-nav-clearance)' }}><SuperchargedInbox currentUserProfile={profile} voltzBalance={profile?.current_voltz ?? 0} onOpenVoltzModal={() => setShowVoltzModal(true)} /></div>}
      {activeScreen === 'profile' && <div className="h-full min-h-0 box-border" style={{ paddingBottom: 'var(--sc-nav-clearance)' }}><SuperchargedProfile /></div>}

      <VoltzOverlay
        open={showVoltzModal}
        onClose={() => { setShowVoltzModal(false); setPendingConfirmation(null); }}
        profile={profile}
        onProfileUpdate={handleProfileUpdate}
        initialScreen={pendingConfirmation ? 'confirmation' : undefined}
        initialResult={pendingConfirmation}
      />

      <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
        <div className="pointer-events-auto w-[min(92vw,430px)] rounded-[22px] border border-border-light bg-white/88 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-1">
            {navItems.map((item) => {
              const isActive = activeScreen === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveScreen(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-colors ${
                    (isActive || (item.key === 'home' && activeScreen === 'search')) ? 'text-text bg-white border border-border-light shadow-sm' : 'text-text3 hover:text-text'
                  }`}
                >
                  <item.Icon size={18} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}


// ─── App Orchestrator ─────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState(null)
  const [step, setStep] = useState('checking')
  const [docId, setDocId] = useState(null)
  const [profile, setProfile] = useState(null)

  // Capture referral code from URL on first load
  useEffect(() => {
    const refCode = new URLSearchParams(window.location.search).get('ref')
    if (refCode) sessionStorage.setItem('sc_referral_code', refCode)
  }, [])

  const checkSession = async () => {
    let authenticatedUser = null

    try {
      authenticatedUser = await account.get()
      setUser(authenticatedUser)
      identifyUser(authenticatedUser.$id, { email: authenticatedUser.email })
    } catch {
      logoutUser()
      setUser(null)
      setProfile(null)
      setDocId(null)
      setStep('onboarding')
      return
    }

    try {
      const result = await tables.listRows({
        databaseId: DB_ID,
        tableId: PROFILES_TABLE,
        queries: [Query.equal('user_id', authenticatedUser.$id), Query.limit(1)]
      })
      if (result.rows.length > 0) {
        const existingProfile = result.rows[0]
        if (existingProfile.is_onboarding_complete && existingProfile.is_indexed) {
          setProfile(existingProfile)
          setStep('discovery')
        } else if (existingProfile.is_onboarding_complete) {
          setDocId(existingProfile.$id)
          setStep('loading')
        } else {
          setDocId(existingProfile.$id)
          setStep('onboarding')
          track.onboardingStarted()
        }
      } else {
        setStep('onboarding')
        track.onboardingStarted()
      }
    } catch (err) {
      console.error('Profile lookup failed for active session:', err)
      captureError(err, { context: 'profile_lookup_on_session_check' })
      setProfile(null)
      setDocId(null)
      setStep('onboarding')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkSession()
  }, [])

  const handleAuth = () => {
    checkSession()
  }
  const handleOnboardingComplete = (id) => {
    track.onboardingCompleted()
    setDocId(id)
    setStep('loading')
  }
  const handleSynced = (doc) => {
    setProfile(doc)
    setStep('discovery')
  }

  return (
    <div className="selection:bg-accent selection:text-text">
      {step === 'checking' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text" />
        </div>
      )}
      {step === 'onboarding' && <NewOnboarding user={user} onAuth={handleAuth} onComplete={handleOnboardingComplete} />}
      {step === 'loading' && <LoadingScreen docId={docId} onReady={handleSynced} />}
      {step === 'discovery' && (
        <MainApp
          profile={profile}
          user={user}
          onProfileUpdate={(p) => setProfile(p)}
        />
      )}
    </div>
  )
}

export default Sentry.withProfiler(App)
