import { useState, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { databases, account, functions, DB_ID, PROFILES_COLLECTION, DISCOVERY_FUNCTION_ID, ID, Query } from './lib/appwrite'

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('signup') // 'signup' or 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        // Create account then log in
        await account.create(ID.unique(), email, password, name)
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 font-mono text-center">Supercharged</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {mode === 'signup' ? 'Create your account to get started.' : 'Welcome back.'}
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text" required value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password" required value={password} minLength={8}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-black text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'signup' ? 'Already have an account? ' : 'No account? '}
          <button
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }}
            className="underline text-gray-900 hover:text-gray-600"
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Onboarding Form ──────────────────────────────────────────────────────────
function OnboardingScreen({ user, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    college: '',
    course: '',
    stage: 'Undergrad',
    social_energy: 3,
    primary_intent: 'Professional Networking',
    free_text_responses: ''
  })
  const posthog = usePostHog()

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (posthog) {
        posthog.identify(user.$id, { email: user.email, name: user.name })
        posthog.capture('Onboarding Completed', { intent: formData.primary_intent })
      }

      const doc = await databases.createDocument(
        DB_ID,
        PROFILES_COLLECTION,
        ID.unique(),
        {
          user_id: user.$id,     // Use real Appwrite user ID
          full_name: user.name,
          college: formData.college,
          course: formData.course,
          stage: formData.stage,
          social_energy: parseInt(formData.social_energy, 10),
          primary_intent: formData.primary_intent,
          free_text_responses: formData.free_text_responses,
          is_indexed: false
        }
      )
      onComplete(doc.$id)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 font-mono">Hey, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500 mb-6">Tell us a bit about yourself to find your best connections.</p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">College</label>
              <input type="text" name="college" required onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Course</label>
              <input type="text" name="course" required onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Stage</label>
              <select name="stage" onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none">
                <option>Undergrad</option>
                <option>Masters</option>
                <option>DPhil</option>
                <option>MBA</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Social Energy (1–5)</label>
              <input type="number" name="social_energy" min="1" max="5" defaultValue="3" onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Primary Goal</label>
            <select name="primary_intent" onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none">
              <option>Professional Networking</option>
              <option>Make Friends</option>
              <option>Romance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tell us about yourself</label>
            <textarea name="free_text_responses" rows="4" required onChange={handleChange}
              placeholder="What are you building? What kind of person do you want to meet? What do you love?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-black text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Find my Match →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen({ docId, onReady }) {
  const posthog = usePostHog()

  useEffect(() => {
    if (!docId) return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      if (attempts > 30) {
        clearInterval(interval)
        alert('Sync timeout. Try again.')
        return
      }
      try {
        const doc = await databases.getDocument(DB_ID, PROFILES_COLLECTION, docId)
        if (doc.is_indexed) {
          clearInterval(interval)
          if (posthog) posthog.capture('Profile Synchronized')
          onReady(doc)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [docId])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Vectorizing your personality...</h3>
        <p className="text-sm text-gray-500 mt-2">Gemini is embedding your profile into 1536-dimensional space.</p>
      </div>
    </div>
  )
}

// ─── Match Card Component ─────────────────────────────────────────────────────
function MatchCard({ match, rank }) {
  const intentColors = {
    'Professional Networking': 'bg-blue-50 text-blue-700 border-blue-200',
    'Make Friends': 'bg-green-50 text-green-700 border-green-200',
    'Romance': 'bg-pink-50 text-pink-700 border-pink-200',
  }
  const intentStyle = intentColors[match.primary_intent] || 'bg-gray-50 text-gray-700 border-gray-200'
  const energyBars = Array.from({ length: 5 }, (_, i) => i < match.social_energy)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          {match.full_name && <p className="font-semibold text-gray-900">{match.full_name}</p>}
          <p className="text-sm text-gray-600">{match.college} · {match.course}</p>
          <p className="text-xs text-gray-400">{match.stage}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{match.score}%</p>
          <p className="text-xs text-gray-400">compatible</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${intentStyle}`}>
          {match.primary_intent}
        </span>
        <div className="flex gap-0.5">
          {energyBars.map((filled, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${filled ? 'bg-gray-800' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>
      {match.semantic_pct > 0 && match.intent_pct > 0 && (
        <p className="text-xs text-gray-400">
          Semantic {match.semantic_pct}% · Intent {match.intent_pct}%
        </p>
      )}
    </div>
  )
}

// ─── Discovery Screen ─────────────────────────────────────────────────────────
function DiscoveryScreen({ profile, user }) {
  const [matches, setMatches] = useState([])
  const [searchResults, setSearchResults] = useState(null) // null = not yet searched
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('') // the query that was actually submitted
  const [error, setError] = useState('')
  const posthog = usePostHog()

  const callDiscovery = async (body) => {
    const exec = await functions.createExecution(
      DISCOVERY_FUNCTION_ID,
      JSON.stringify(body),
      false // synchronous
    )
    return JSON.parse(exec.responseBody)
  }

  // Load recommendations on mount
  useEffect(() => {
    const loadMatches = async () => {
      try {
        const data = await callDiscovery({ action: 'recommend', docId: profile.$id })
        if (data.error) throw new Error(data.error)
        setMatches(data.matches || [])
        if (posthog) posthog.capture('Matches Viewed', { count: data.matches?.length })
      } catch (e) {
        setError(e.message)
      } finally {
        setLoadingMatches(false)
      }
    }
    loadMatches()
  }, [profile.$id])

  // Search only fires on explicit submit (Enter or button click)
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
      if (posthog) posthog.capture('Discovery Search', { query: q })
    } catch (e) {
      console.error(e)
    } finally {
      setSearching(false)
    }
  }

  // Clear search when input is emptied
  const handleInputChange = (e) => {
    setQuery(e.target.value)
    if (!e.target.value.trim()) {
      setSearchResults(null)
      setActiveQuery('')
    }
  }

  const handleLogout = async () => {
    await account.deleteSession('current')
    window.location.reload()
  }

  const displayMatches = searchResults !== null ? searchResults : matches
  const isSearchMode = searchResults !== null

  return (
    <div className="h-screen flex flex-col bg-gray-50 max-w-xl mx-auto">

      {/* ── Header (fixed top) ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-gray-50 border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-mono">Supercharged</h1>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <button onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 underline">
          Log out
        </button>
      </div>

      {/* ── Scrollable results area ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Section label */}
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          {isSearchMode ? `Results for "${activeQuery}"` : 'Top Matches for You'}
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingMatches && !isSearchMode && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Searching skeleton */}
        {searching && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Match cards */}
        {!loadingMatches && !searching && (
          <div className="space-y-3">
            {displayMatches.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                {isSearchMode
                  ? 'No results found. Try a different search.'
                  : 'No matches yet — the pool is being built!'}
              </p>
            ) : (
              displayMatches.map((match, i) => (
                <MatchCard key={match.user_id || i} match={match} rank={i + 1} />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Search bar (pinned to bottom) ─────────────────────────────── */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by interest, skill, goal..."
            value={query}
            onChange={handleInputChange}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shrink-0"
            aria-label="Search"
          >
            {/* Up arrow icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-1.5 pl-1">
          Press Enter or ↑ to search · Empty to return to top matches
        </p>
      </div>

    </div>
  )
}


// ─── App Orchestrator ─────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null)
  const [step, setStep] = useState('checking') // checking, auth, onboarding, loading, discovery
  const [docId, setDocId] = useState(null)
  const [profile, setProfile] = useState(null)

  // On mount: restore session and route to the correct screen.
  // This handles 4 production cases:
  //   1. No session      → Auth screen
  //   2. Session, no profile → Onboarding
  //   3. Session, profile pending sync → Loading (polls until is_indexed=true)
  //   4. Session, profile ready → Discovery (no interruption)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const authenticatedUser = await account.get();
        setUser(authenticatedUser);

        // Check for an existing profile for this user
        const result = await databases.listDocuments(
          DB_ID,
          PROFILES_COLLECTION,
          [Query.equal('user_id', authenticatedUser.$id), Query.limit(1)]
        );

        if (result.documents.length > 0) {
          const existingProfile = result.documents[0];
          if (existingProfile.is_indexed) {
            // Returning user — go straight to Discovery
            setProfile(existingProfile);
            setStep('discovery');
          } else {
            // Profile submitted but vectorization not complete yet
            setDocId(existingProfile.$id);
            setStep('loading');
          }
        } else {
          // Authenticated but no profile yet — fresh onboarding
          setStep('onboarding');
        }
      } catch {
        // No valid session — show the Auth screen
        setStep('auth');
      }
    };

    checkSession();
  }, []);

  const handleAuth = (u) => { setUser(u); setStep('onboarding') }
  const handleOnboardingComplete = (id) => { setDocId(id); setStep('loading') }
  const handleSynced = (doc) => { setProfile(doc); setStep('discovery') }

  if (step === 'checking') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
    </div>
  )
  if (step === 'auth') return <AuthScreen onAuth={handleAuth} />
  if (step === 'onboarding' && user) return <OnboardingScreen user={user} onComplete={handleOnboardingComplete} />
  if (step === 'loading') return <LoadingScreen docId={docId} onReady={handleSynced} />
  if (step === 'discovery') return <DiscoveryScreen profile={profile} user={user} />

  return null
}

export default App

