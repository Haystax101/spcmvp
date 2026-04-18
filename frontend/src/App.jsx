import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronRight, 
  ChevronLeft, 
  ArrowRight, 
  Send, 
  Upload, 
  User, 
  LogOut, 
  Search,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { databases, account, functions, DB_ID, PROFILES_COLLECTION, DISCOVERY_FUNCTION_ID, ID, Query } from './lib/appwrite'

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
      if (mode === 'signup') {
        const tempName = email.split('@')[0]
        await account.create(ID.unique(), email, password, tempName)
        await account.createEmailPasswordSession(email, password)
      } else {
        await account.createEmailPasswordSession(email, password)
      }
      const user = await account.get()
      onAuth(user)
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <TopoBackground />
      <motion.div 
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
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-50 border border-red-100 text-xs text-error font-medium"
          >
            {error}
          </motion.div>
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
      </motion.div>
    </div>
  )
}

// ─── Helper Components ────────────────────────────────────────────────────────

const StepContainer = ({ children, title, subtitle, onBack, onNext, nextDisabled, isFirst, isLast, loading, stepIdx }) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="w-full max-w-2xl mx-auto px-6 py-12 relative z-10"
  >
    <div className="mb-12 flex items-center justify-between">
      {!isFirst ? (
        <button onClick={onBack} className="p-2 -ml-2 text-text3 hover:text-text transition-colors cursor-pointer">
          <ChevronLeft size={24} />
        </button>
      ) : <div />}
      <div className="flex gap-1.5 px-4">
        {[...Array(15)].map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= stepIdx ? 'w-6 bg-accent' : 'w-2 bg-border-light'}`} />
        ))}
      </div>
      <div className="w-8" />
    </div>

    <h2 className="font-playfair text-4xl mb-3 font-light leading-tight">{title}</h2>
    {subtitle && <p className="text-text2 text-lg mb-12 font-sans leading-relaxed">{subtitle}</p>}
    
    <div className="min-h-[200px] relative z-10">
      {children}
    </div>

    <div className="mt-16 flex justify-end relative z-20">
      <button
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="group flex items-center gap-3 bg-text text-white px-10 py-5 rounded-full text-sm font-semibold hover:bg-black transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.98] cursor-pointer"
      >
        {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : isLast ? 'Complete Profile' : 'Next'}
        {!loading && !isLast && <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />}
      </button>
    </div>
  </motion.div>
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
  const [formData, setFormData] = useState({
    first_name: user.name.split(' ')[0],
    last_name: user.name.split(' ')[1] || '',
    college: '',
    career_field: '',
    goals: [],
    desired_connections: [],
    social_circles: [],
    friendship_values: [],
    intellectual_identity: '',
    wish_studied: '',
    work_style: '',
    project_stage: '',
    relationship_intent: '',
    honest_thing: '',
    social_energy: 3,
    friend_references: [],
    is_onboarding_complete: false
  })

  // We could add more complex step logic here (conditional branches)
  const steps = [
    'name', 'college', 'goals', 'career', 'connections', 
    'social-life', 'values', 'intellect', 'wish', 'work', 
    'project', 'dating', 'truth', 'energy', 'referral'
  ]

  const handleNext = async () => {
    setLoading(true)
    try {
      // Create or update document in Appwrite
      if (!docId) {
        const doc = await databases.createDocument(DB_ID, PROFILES_COLLECTION, ID.unique(), {
          ...formData,
          user_id: user.$id,
          full_name: user.name
        })
        setDocId(doc.$id)
      } else {
        await databases.updateDocument(DB_ID, PROFILES_COLLECTION, docId, formData)
      }

      if (step === steps.length - 1) {
        // Final Step: mark complete
        await databases.updateDocument(DB_ID, PROFILES_COLLECTION, docId, { is_onboarding_complete: true })
        onComplete(docId)
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

  return (
    <div className="min-h-screen bg-bg relative overflow-y-auto flex flex-col justify-center">
      <TopoBackground />
      <AnimatePresence mode="wait">
        
        {steps[step] === 'name' && (
          <StepContainer 
            key="name" title={`First, let's get your name right.`} isFirst onNext={handleNext} loading={loading} stepIdx={step}
          >
            <div className="flex gap-8">
              <input 
                autoFocus placeholder="First name" value={formData.first_name}
                onChange={e => update('first_name', e.target.value)}
                className="flex-1 bg-transparent border-b border-border py-4 font-playfair text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
              />
              <input 
                placeholder="Last name" value={formData.last_name}
                onChange={e => update('last_name', e.target.value)}
                className="flex-1 bg-transparent border-b border-border py-4 font-playfair text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
              />
            </div>
          </StepContainer>
        )}

        {steps[step] === 'college' && (
          <StepContainer 
            key="college" title="Which college are you at?" subtitle="And what are you studying?" 
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
          >
            <input 
              autoFocus placeholder="Ex. Magdalen" value={formData.college}
              onChange={e => update('college', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'goals' && (
          <StepContainer 
            key="goals" title="What describes you best?" subtitle="Select all that apply."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
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
          >
            <div className="flex flex-wrap gap-3">
              {["Tech & AI", "Finance", "Consulting", "Research & Academia", "Medicine", "Law", "Arts & Creative", "Public Policy"].map(c => (
                <Chip key={c} label={c} selected={formData.career_field === c} onClick={() => update('career_field', c)} />
              ))}
            </div>
          </StepContainer>
        )}

        {steps[step] === 'connections' && (
          <StepContainer 
            key="connections" title="Who are you looking to connect with?" subtitle="Select your top 3."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
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
          >
            <input 
              autoFocus placeholder="Ex. Astrophysics or Fine Art" value={formData.wish_studied}
              onChange={e => update('wish_studied', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-5xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3"
            />
          </StepContainer>
        )}

        {steps[step] === 'work' && (
          <StepContainer 
            key="work" title="How do you work best?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
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

        {steps[step] === 'truth' && (
          <StepContainer 
            key="truth" title="What's one thing people don't realise?" subtitle="The most honest thing about you."
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
          >
            <textarea 
              autoFocus rows={4} placeholder="Be brave..." value={formData.honest_thing}
              onChange={e => update('honest_thing', e.target.value)}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3 resize-none"
            />
          </StepContainer>
        )}

        {steps[step] === 'energy' && (
          <StepContainer 
            key="energy" title="How much social energy do you have?" 
            subtitle="Are you a quiet observer or the life of the party?"
            onBack={() => setStep(s => s - 1)} onNext={handleNext} loading={loading} stepIdx={step}
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
          >
            <textarea 
              autoFocus rows={4} placeholder="Ex. David at Balliol, or anyone in the rowing team..." value={formData.friend_references.join(', ')}
              onChange={e => update('friend_references', e.target.value.split(',').map(s => s.trim()))}
              className="w-full bg-transparent border-b border-border py-4 font-playfair text-3xl focus:border-accent transition-colors focus:outline-none placeholder:text-text3 resize-none"
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
        const doc = await databases.getDocument(DB_ID, PROFILES_COLLECTION, docId)
        if (doc.is_indexed) {
          clearInterval(interval)
          onReady(doc)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [docId])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-bg">
      <TopoBackground />
      <div className="text-center relative z-10">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-8"
        >
          ✨
        </motion.div>
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
    <motion.div 
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

        {match.honest_thing && (
          <div className="relative">
             <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-accent/30" />
             <p className="text-sm italic text-text2 leading-relaxed">
               "{match.honest_thing.substring(0, 120)}..."
             </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Discovery Screen ─────────────────────────────────────────────────────────
function DiscoveryScreen({ profile, user }) {
  const [matches, setMatches] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [error, setError] = useState('')

  const callDiscovery = async (body) => {
    const exec = await functions.createExecution(DISCOVERY_FUNCTION_ID, JSON.stringify(body), false)
    return JSON.parse(exec.responseBody)
  }

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const data = await callDiscovery({ action: 'recommend', docId: profile.$id })
        if (data.error) throw new Error(data.error)
        setMatches(data.matches || [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoadingMatches(false)
      }
    }
    loadMatches()
  }, [profile.$id])

  const handleSearch = async (e) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q) {
      setSearchResults(null)
      setActiveQuery('')
      return
    }
    setSearching(true)
    setActiveQuery(q)
    try {
      const data = await callDiscovery({ action: 'search', query: q })
      setSearchResults(data.matches || [])
    } catch (e) {
      console.error(e)
    } finally {
      setSearching(false)
    }
  }

  const handleLogout = async () => {
    await account.deleteSession('current')
    window.location.reload()
  }

  const displayMatches = searchResults !== null ? searchResults : matches
  const isSearchMode = searchResults !== null

  return (
    <div className="h-screen flex flex-col bg-bg max-w-2xl mx-auto border-x border-border-light relative">
      <TopoBackground />
      
      {/* Header */}
      <header className="px-8 pt-10 pb-6 flex items-center justify-between border-b border-border-light/50 bg-bg/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h1 className="font-playfair text-2xl font-light tracking-tight">Supercharged</h1>
          <p className="font-jetbrains text-[10px] text-text3 uppercase tracking-widest mt-1">DISCOVERY ENGINE V3.1</p>
        </div>
        <button onClick={handleLogout} className="p-2 text-text3 hover:text-text transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-12">
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-playfair text-3xl font-light">
              {isSearchMode ? `Searching for "${activeQuery}"` : 'Your matches'}
            </h2>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-border-light" />)}
            </div>
          </div>

          {(loadingMatches || searching) ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-white border border-border-light animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              {displayMatches.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border-light">
                  <p className="text-text3 italic">No connections found in this dimensional space.</p>
                </div>
              ) : (
                displayMatches.map((match, i) => (
                  <MatchCard key={match.user_id || i} match={match} rank={i} />
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* Search Interaction (Floating Pill) */}
      <div className="px-8 py-6 bg-bg/80 backdrop-blur-md">
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            placeholder="Search by interest, goal, or field..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-border-light rounded-full px-8 py-5 text-sm focus:border-text focus:outline-none transition-all pr-16 shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="absolute right-3 top-2.5 w-10 h-10 rounded-full bg-text text-white flex items-center justify-center hover:bg-black transition-all disabled:opacity-20"
          >
            {searching ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <ArrowRight size={18} />}
          </button>
        </form>
        <div className="mt-4 flex justify-center gap-6 text-[10px] font-mono text-text3 uppercase tracking-widest">
           <span>Press Enter to scout</span>
           <span>•</span>
           <span>Clear to reset</span>
        </div>
      </div>
    </div>
  )
}


// ─── App Orchestrator ─────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState(null)
  const [step, setStep] = useState('checking')
  const [docId, setDocId] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const authenticatedUser = await account.get()
        setUser(authenticatedUser)
        const result = await databases.listDocuments(DB_ID, PROFILES_COLLECTION, [Query.equal('user_id', authenticatedUser.$id), Query.limit(1)])
        if (result.documents.length > 0) {
          const existingProfile = result.documents[0]
          if (existingProfile.is_onboarding_complete && existingProfile.is_indexed) {
            setProfile(existingProfile)
            setStep('discovery')
          } else if (existingProfile.is_onboarding_complete) {
            setDocId(existingProfile.$id)
            setStep('loading')
          } else {
            setDocId(existingProfile.$id)
            setStep('onboarding')
          }
        } else {
          setStep('onboarding')
        }
      } catch {
        setStep('auth')
      }
    }
    checkSession()
  }, [])

  const handleAuth = (u) => { setUser(u); setStep('onboarding') }
  const handleOnboardingComplete = (id) => { setDocId(id); setStep('loading') }
  const handleSynced = (doc) => { setProfile(doc); setStep('discovery') }

  return (
    <div className="selection:bg-accent selection:text-text">
      {step === 'checking' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text" />
        </div>
      )}
      {step === 'auth' && <AuthScreen onAuth={handleAuth} />}
      {step === 'onboarding' && user && <OnboardingScreen user={user} onComplete={handleOnboardingComplete} />}
      {step === 'loading' && <LoadingScreen docId={docId} onReady={handleSynced} />}
      {step === 'discovery' && <DiscoveryScreen profile={profile} user={user} />}
    </div>
  )
}

export default App

