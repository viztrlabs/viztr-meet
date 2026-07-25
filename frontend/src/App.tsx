import { useState, useRef, useCallback, useEffect } from 'react'
import { InstallPrompt } from './hooks/useInstallPrompt'

const BACKEND = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const SAMPLE_RATE = 16000

type LogEntry = {
  text: string
  lang?: string
  event: string
  ts: number
}

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

type PipelineStage = 'idle' | 'vad' | 'asr' | 'translate' | 'tts' | 'playing'

type Participant = {
  id: string
  name: string
  isLocal: boolean
  muted: boolean
  speaking: boolean
  joinedAt: number
}

type Settings = {
  vadThreshold: number
  vadMinSilenceMs: number
  chunkTargetMs: number
  noiseFilter: boolean
  vadMaxBufferMs: number
  interruptThresholdDb: number
  ttsVoice: string
}

type User = {
  id: string
  name: string
  email: string
}

function AuthScreen({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSignUp ? '/auth/signup' : '/auth/login'
      const body = isSignUp ? { name, email, password } : { email, password }
      
      const res = await fetch(`${BACKEND}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed')
      }

      localStorage.setItem('viztr_token', data.token)
      localStorage.setItem('viztr_user', JSON.stringify(data.user))
      onLogin(data.user, data.token)
    } catch (err: any) {
      setError(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">VizTR Meet</h1>
          <p className="text-gray-400">Real-time voice translation for everyone</p>
        </div>
        
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ParticipantItem({ participant, onToggleMute, isLocal }: { 
  participant: Participant
  onToggleMute: (id: string) => void
  isLocal: boolean
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${participant.speaking ? 'bg-green-900/30 border-green-500/50' : 'bg-gray-800/50'} border transition-all duration-200`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${participant.muted ? 'bg-red-600' : participant.isLocal ? 'bg-blue-600' : 'bg-purple-600'}`}>
        {participant.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">{participant.name}</span>
          {participant.isLocal && <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded">You</span>}
          {participant.speaking && <span className="text-xs bg-green-600 px-1.5 py-0.5 rounded animate-pulse">🎤 Speaking</span>}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
          <span className="flex items-center gap-1">
            {participant.muted ? '🔇' : '🔊'} {participant.muted ? 'Muted' : 'Live'}
          </span>
        </div>
      </div>
      <button
        onClick={() => onToggleMute(participant.id)}
        className={`p-2 rounded-lg transition-colors ${participant.muted ? 'bg-red-600/20 hover:bg-red-600/40' : 'bg-gray-700/50 hover:bg-gray-600'}`}
        aria-label={participant.muted ? 'Unmute' : 'Mute'}
        title={participant.muted ? 'Unmute' : 'Mute'}
        disabled={!participant.isLocal}
      >
        {participant.muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}

function ParticipantPanel({ 
  participants, 
  localParticipantId, 
  onToggleMute,
  onClose 
}: { 
  participants: any[]
  localParticipantId: string
  onToggleMute: (id: string) => void
  onClose: () => void
}) {
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.id === localParticipantId) return -1
    if (b.id === localParticipantId) return 1
    return a.joinedAt - b.joinedAt
  })

  return (
    <div className="fixed right-0 top-0 bottom-0 w-72 bg-gray-900 border-l border-gray-700 z-40 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-semibold text-white">Participants ({participants.length})</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close panel">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {participants.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No participants yet</p>
        ) : (
          participants.map(p => (
            <ParticipantItem
              key={p.id}
              participant={p}
              onToggleMute={(id) => (id === p.id ? (p.muted ? false : true) : null) && (p.muted ? false : true) && true}
              isLocal={p.id === 'local'}
            />
          ))
        )}
      </div>
      <div className="p-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Click microphone icon to mute/unmute
        </p>
      </div>
    </div>
  )
}

function Overlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div 
      className="fixed inset-0 bg-black/50 z-30"
      onClick={onClose}
      aria-hidden="true"
    />
  )
}

function WaveformVisualizer({ 
  isRecording, 
  isMuted, 
  audioLevel = 0 
}: { 
  isRecording: boolean
  isMuted: boolean
  audioLevel: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const historyRef = useRef<number[]>(new Array(60).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    const animate = () => {
      frame++
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = canvas.width / window.devicePixelRatio
      const height = canvas.height / window.devicePixelRatio

      // Clear
      ctx.clearRect(0, 0, width, height)

      // Draw background
      ctx.fillStyle = '#030712'
      ctx.fillRect(0, 0, width, height)

      // Center line
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      // Draw waveform
      const barWidth = width / 60
      const centerY = height / 2

      for (let i = 0; i < 60; i++) {
        const level = historyRef.current[i] || 0
        const barHeight = (level / 255) * (height / 2) * 0.8
        const x = i * (width / 60) + barWidth / 2
        
        // Color based on level
        const intensity = Math.min(1, level / 128)
        const hue = 120 - intensity * 120 // Green to red
        const color = `hsl(${hue}, 80%, 50%)`
        
        ctx.fillStyle = color
        const barHeight = barHeight * 2
        ctx.fillRect(
          x - 1.5,
          centerY - barHeight / 2,
          3,
          barHeight
        )
      }

      // Draw center line indicator
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()
      ctx.setLineDash([])

      // Muted indicator
      if (isRecording && isMuted) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'
        ctx.font = 'bold 12px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('🔇 MUTED', canvas.width / 2 / window.devicePixelRatio, 20)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animationRef.current!)
  }, [isRecording, isMuted])

  // Update audio level history (called from outside)
  const updateLevel = useCallback((level: number) => {
    historyRef.current.shift()
    historyRef.current.push(level)
  }, [])

  return (
    <div className="relative w-full h-24 bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
        aria-label="Audio waveform visualization"
      />
      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-xs text-gray-500">
        <span>-60 dB</span>
        <span>0 dB</span>
        <span>-60 dB</span>
      </div>
    </div>
  )
}

function SettingsPanel({ 
  settings, 
  onSettingsChange, 
  onClose 
}: { 
  settings: Settings
  onSettingsChange: (s: Partial<Settings>) => void
  onClose: () => void
}) {
  const voiceOptions = [
    { value: 'en-US-AriaNeural', label: 'Aria (US English)' },
    { value: 'en-US-GuyNeural', label: 'Guy (US English)' },
    { value: 'es-ES-ElviraNeural', label: 'Elvira (Spanish)' },
    { value: 'fr-FR-DeniseNeural', label: 'Denise (French)' },
    { value: 'de-DE-KatjaNeural', label: 'Katja (German)' },
    { value: 'ja-JP-NanamiNeural', label: 'Nanami (Japanese)' },
    { value: 'zh-CN-XiaoxiaoNeural', label: 'Xiaoxiao (Chinese)' },
    { value: 'ar-SA-ZariyahNeural', label: 'Zariyah (Arabic)' },
  ]

  return (
    <div className="fixed left-0 top-0 bottom-0 w-80 bg-gray-900 border-r border-gray-700 z-40 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-semibold text-white">Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close panel">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* VAD Settings */}
        <div className="space-y-4">
          <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400">Voice Activity Detection</h3>
          
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">VAD Threshold</span>
              <span className="text-xs text-gray-500">{settings.vadThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={settings.vadThreshold}
              onChange={e => onSettingsChange({ vadThreshold: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none accent-blue-500"
            />
            <p className="text-xs text-gray-500">Speech confidence threshold (higher = less sensitive)</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Min Silence Duration</span>
              <span className="text-xs text-gray-500">{settings.vadMinSilenceMs}ms</span>
            </label>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={settings.vadMinSilenceMs}
              onChange={e => onSettingsChange({ vadMinSilenceMs: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none accent-blue-500"
            />
            <p className="text-xs text-gray-500">Minimum silence before ending speech segment</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Max Buffer Duration</span>
              <span className="text-xs text-gray-500">{settings.vadMaxBufferMs}ms</span>
            </label>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={settings.vadMaxBufferMs}
              onChange={e => onSettingsChange({ vadMaxBufferMs: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none accent-blue-500"
            />
            <p className="text-xs text-gray-500">Safety ceiling - force release after this duration</p>
          </div>
        </div>

        {/* Audio Processing Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400">Audio Processing</h3>
          
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Chunk Target Duration</span>
              <span className="text-xs text-gray-500">{settings.chunkTargetMs}ms</span>
            </label>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={settings.chunkTargetMs}
              onChange={e => onSettingsChange({ chunkTargetMs: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none accent-blue-500"
            />
            <p className="text-xs text-gray-500">Audio buffer window before ASR processing</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Interrupt Threshold</span>
              <span className="text-xs text-gray-500">{settings.interruptThresholdDb}dB</span>
            </label>
            <input
              type="range"
              min="-50"
              max="-20"
              step="1"
              value={settings.interruptThresholdDb}
              onChange={e => onSettingsChange({ interruptThresholdDb: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none accent-blue-500"
            />
            <p className="text-xs text-gray-500">Audio level that cancels TTS playback</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Noise Filtering</span>
            <button
              onClick={() => onSettingsChange({ noiseFilter: !settings.noiseFilter })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.noiseFilter ? 'bg-blue-600' : 'bg-gray-600'
              }`}
              role="switch"
              aria-checked={settings.noiseFilter}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.noiseFilter ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">Reduce background noise before processing</p>
        </div>

        {/* TTS Settings */}
        <div className="pt-4 border-t border-gray-700">
          <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400">Text-to-Speech</h3>
          
          <div className="space-y-2">
            <label className="block text-sm text-gray-300 mb-1">TTS Voice</label>
            <select
              value={settings.ttsVoice}
              onChange={e => onSettingsChange({ ttsVoice: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {voiceOptions.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Voice for translated speech output</p>
          </div>
        </div>

        {/* Apply to Server Button */}
        <div className="pt-4 border-t border-gray-700">
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            onClick={() => {
              // Send settings to server via WebSocket
              console.log('Apply settings:', settings)
            }}
          >
            Apply Settings
          </button>
        </div>
      </div>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onClose}
          className="w-full text-gray-400 hover:text-white py-2 text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function MeetingSummaryPanel({ 
  logs, 
  onClose,
  onExport 
}: { 
  logs: LogEntry[]
  onClose: () => void
  onExport: (format: 'json' | 'txt' | 'md') => void
}) {
  const [summary, setSummary] = useState<string>('')
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [actionItems, setActionItems] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [notes, setNotes] = useState('')

  const generateSummary = useCallback(async () => {
    setIsGenerating(true)
    // Filter relevant log entries (transcripts and translations)
    const relevantLogs = logs.filter(l => 
      l.event === 'transcript' || l.event === 'translation' || l.event === 'vad_end'
    )
    
    const transcriptText = relevantLogs
      .filter(l => l.event === 'transcript')
      .map(l => `[${new Date(l.ts).toLocaleTimeString()}] ${l.lang || 'auto'}: ${l.text}`)
      .join('\n')
    
    const translationText = relevantLogs
      .filter(l => l.event === 'translation')
      .map(l => `[${new Date(l.ts).toLocaleTimeString()}] ${l.lang || 'en'}: ${l.text}`)
      .join('\n')

    // Simulate LLM summary generation (in production, call backend API)
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const generatedSummary = `Meeting Summary (${new Date().toLocaleDateString()})
Duration: ${logs.length > 0 ? Math.round((logs[logs.length - 1].ts - logs[0].ts) / 60000) : 0} minutes
Participants: ${new Set(logs.filter(l => l.lang).map(l => l.lang)).size} languages

${transcriptText ? `Original Speech:\n${transcriptText}\n` : ''}
${translationText ? `Translations:\n${translationText}\n` : ''}

Key Topics Discussed:
- Language translation and communication
- Real-time voice processing
- Multi-language meeting support`

    const generatedKeyPoints = [
      'Real-time voice translation pipeline demonstrated',
      'Multi-language support (auto-detect source, multiple targets)',
      'VAD-based audio segmentation working correctly',
      'TTS playback functioning for translated output',
      'Pipeline visualization showing all stages active'
    ]

    const generatedActionItems = [
      'Review translation accuracy for production deployment',
      'Configure provider failover for production',
      'Set up monitoring dashboards for pipeline metrics',
      'Test with larger participant groups'
    ]

    setSummary(generatedSummary)
    setKeyPoints(generatedKeyPoints)
    setActionItems(generatedActionItems)
    setIsGenerating(false)
  }, [logs])

  const handleExport = (format: 'json' | 'txt' | 'md') => {
    const data = {
      summary,
      keyPoints,
      actionItems,
      notes,
      generatedAt: new Date().toISOString(),
      meetingId: `meeting-${Date.now()}`,
      transcriptCount: logs.filter(l => l.event === 'transcript').length,
      translationCount: logs.filter(l => l.event === 'translation').length
    }

    let content: string
    let mimeType: string
    let extension: string

    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2)
        mimeType = 'application/json'
        extension = 'json'
        break
      case 'md':
        content = `# Meeting Summary\n\n${summary}\n\n## Key Points\n${keyPoints.map(p => `- ${p}`).join('\n')}\n\n## Action Items\n${actionItems.map(a => `- [ ] ${a}`).join('\n')}\n\n## Notes\n${notes}\n\n---\n*Generated at ${new Date().toISOString()}*`
        mimeType = 'text/markdown'
        extension = 'md'
        break
      case 'txt':
      default:
        content = `MEETING SUMMARY\n${'='.repeat(50)}\n\n${summary}\n\nKEY POINTS:\n${keyPoints.map(p => `- ${p}`).join('\n')}\n\nACTION ITEMS:\n${actionItems.map(a => `- [ ] ${a}`).join('\n')}\n\nNOTES:\n${notes}\n\n---\nGenerated: ${new Date().toISOString()}`
        mimeType = 'text/plain'
        extension = 'txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-summary-${Date.now()}.${extension}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-900 border-l border-gray-700 z-40 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-semibold text-white">Meeting Summary</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close panel">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Generate Summary Button */}
        <button
          onClick={generateSummary}
          disabled={isGenerating || logs.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Generate AI Summary
            </>
          )}
        </button>

        {/* Summary Display */}
        {summary && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="font-medium text-white mb-2">Summary</h3>
              <pre className="whitespace-pre-wrap text-sm text-gray-300">{summary}</pre>
            </div>
          </div>}

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400">Key Points</h3>
            <ul className="space-y-2">
              {keyPoints.map((point, i) => (
                <li key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-gray-300 text-sm flex-1">{point}</span>
                </li>
              ))}
            </ul>
          </div>)}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400">Action Items</h3>
            <ul className="space-y-2">
              {actionItems.map((item, i) => (
                <li key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-700 focus:ring-blue-500" />
                  <span className="text-gray-300 text-sm flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>)}

        {/* Notes Section */}
        <div className="pt-4 border-t border-gray-700">
          <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400 mb-2">Meeting Notes</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add your meeting notes here..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Export Options */}
        <div className="pt-4 border-t border-gray-700">
          <h3 className="font-medium text-white text-sm uppercase tracking-wider text-gray-400 mb-3">Export</h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onExport('md')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              .md
            </button>
            <button
              onClick={() => onExport('txt')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            >
              .txt
            </button>
            <button
              onClick={() => onExport('json')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            >
              .json
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onClose}
          className="w-full text-gray-400 hover:text-white py-2 text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
}

function WaveformVisualizer({ 
  isRecording, 
  isMuted, 
  audioLevel 
}: { 
  isRecording: boolean
  isMuted: boolean
  audioLevel: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(null)
  const barsRef = useRef<number[]>(Array(32).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width = canvas.offsetWidth * window.devicePixelRatio
    const height = canvas.height = canvas.offsetHeight * window.devicePixelRatio

    const draw = () => {
      // Decay bars
      barsRef.current = barsRef.current.map(v => Math.max(v * 0.92, 0))
      
      // Add new value if recording and not muted
      if (audioLevel > 0) {
        const target = Math.min(audioLevel * 0.9, 1)
        barsRef.current[0] = Math.max(barsRef.current[0], target)
        // Shift bars
        for (let i = barsRef.current.length - 1; i > 0; i--) {
          barsRef.current[i] = Math.max(barsRef.current[i], barsRef.current[i - 1] * 0.7)
        }
      }

      // Clear
      ctx.clearRect(0, 0, width, height)

      // Draw bars
      const barCount = barsRef.current.length
      const barWidth = width / barCount * 0.7
      const gap = width / barCount * 0.3
      const centerY = height / 2

      barsRef.current.forEach((value, i) => {
        const barHeight = value * height * 0.45
        const x = i * (barWidth + gap) + gap / 2
        
        // Gradient color based on level
        const hue = value > 0.7 ? 0 : value > 0.4 ? 45 : 120
        const saturation = value > 0.7 ? 100 : 80
        const lightness = value > 0.7 ? 50 : 55

        const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight)
        gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness}%)`)
        gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`)

        ctx.fillStyle = gradient
        
        // Draw mirrored bars (top and bottom)
        const radius = 3
        const y = centerY - barHeight / 2
        const h = barHeight
        
        ctx.beginPath()
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, radius)
        ctx.fill()
      })

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationRef.current!)
  }, [audioLevel])

  if (audioLevel === 0) return null

  return (
    <div className="mb-4">
      <canvas
        ref={canvasRef}
        className="w-full h-16 bg-gray-900 rounded-lg border border-gray-700"
        style={{ width: '100%', height: '64px' }}
        aria-label="Audio level meter"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>🎤 Recording</span>
        <span>{Math.round(audioLevel * 100)}%</span>
      </div>
    </div>
  )
}

function App() {
  const [roomId, setRoomId] = useState('room-1')
  const [participantId, setParticipantId] = useState(() => `user-${Math.random().toString(36).slice(2, 6)}`)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('en')
  const [status, setStatus] = useState<Status>('disconnected')
  const [recording, setRecording] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle')
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [localMuted, setLocalMuted] = useState(false)
  const [settings, setSettings] = useState<Settings>({
    vadThreshold: 0.5,
    vadMinSilenceMs: 300,
    chunkTargetMs: 300,
    noiseFilter: true,
    vadMaxBufferMs: 3000,
    interruptThresholdDb: -35,
    ttsVoice: 'en-US-AriaNeural',
  })

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('viztr_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('viztr_token'))

  const handleLogin = useCallback((newUser: User, newToken: string) => {
    setUser(newUser)
    setToken(newToken)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('viztr_token')
    localStorage.removeItem('viztr_user')
    setUser(null)
    setToken(null)
  }, [])

  if (!user || !token) {
    return <AuthScreen onLogin={handleLogin} />
  }

  const onSettingsChange = useCallback((s: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...s }))
  }, [])

  const wsRef = useRef<WebSocket | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ttsQueueRef = useRef<ArrayBuffer[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioProcessorRef = useRef<AudioWorkletNode | null>(null)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 200))
  }, [])

  const addParticipant = useCallback((id: string, name: string, isLocal = false) => {
    setParticipants(prev => {
      if (prev.some(p => p.id === id)) return prev
      return [...prev, {
        id,
        name,
        isLocal,
        muted: false,
        speaking: false,
        joinedAt: Date.now()
      }]
    })
  }, [])

  const removeParticipant = useCallback((id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id))
  }, [])

  const toggleMute = useCallback((id: string) => {
    setParticipants(prev => prev.map(p => 
      p.id === id ? { ...p, muted: !p.muted } : p
    ))
    if (id === 'local') {
      setLocalMuted(prev => !prev)
    }
  }, [])

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 200))
  }, [])

  // Add local participant on connect
  useEffect(() => {
    if (status === 'connected') {
      addParticipant('local', participantId, true)
    } else if (status === 'disconnected') {
      setParticipants([])
    }
  }, [status, participantId, addParticipant])

  const playTtsAudio = useCallback(async () => {
    if (ttsQueueRef.current.length === 0) {
      setTtsPlaying(false)
      setPipelineStage('idle')
      return
    }

    setTtsPlaying(true)
    setPipelineStage('playing')

    const audioData = ttsQueueRef.current.shift()!
    
    try {
      const blob = new Blob([audioData], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      
      if (!audioRef.current) {
        audioRef.current = new Audio()
      }
      
      audioRef.current.src = url
      
      await audioRef.current.play()
      
      audioRef.current.onended = () => {
        URL.revokeObjectURL(url)
        playTtsAudio()
      }
      
      audioRef.current.onerror = () => {
        URL.revokeObjectURL(url)
        playTtsAudio()
      }
    } catch (err) {
      console.error('TTS playback error:', err)
      playTtsAudio()
    }
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setPipelineStage('idle')
    try {
      const res = await fetch(`${BACKEND}/audio/token?room_id=${encodeURIComponent(roomId)}&participant_id=${encodeURIComponent(participantId)}`)
      const { token, ws_url } = await res.json()

      const params = new URLSearchParams({
        room_id: roomId,
        participant_id: participantId,
        token,
        source_lang: sourceLang,
        target_lang: targetLang,
      })

      const ws = new WebSocket(`${ws_url}?${params}`)

      ws.onopen = () => {
        setStatus('connected')
        addLog({ text: 'WebSocket connected', event: 'info', ts: Date.now() })
      }

      ws.onmessage = (ev) => {
        if (ev.data instanceof Blob) {
          ev.data.arrayBuffer().then(buffer => {
            ttsQueueRef.current.push(buffer)
            if (!ttsPlaying) {
              playTtsAudio()
            }
          })
          return
        }

        try {
          const msg = JSON.parse(ev.data)
          addLog({ text: msg.text, lang: msg.lang, event: msg.event, ts: Date.now() })
          
          switch (msg.event) {
            case 'vad_end':
              setPipelineStage('asr')
              break
            case 'transcript':
              setPipelineStage('translate')
              break
            case 'translation':
              setPipelineStage('tts')
              break
            case 'participant_joined':
              if (msg.participant_id !== participantId) {
                addParticipant(msg.participant_id, msg.participant_name || `User ${msg.participant_id.slice(0,6)}`)
              }
              break
            case 'participant_left':
              removeParticipant(msg.participant_id)
              break
            case 'participant_muted':
              setParticipants(prev => prev.map(p => 
                p.id === msg.participant_id ? { ...p, muted: msg.muted } : p
              ))
              break
            case 'participant_speaking':
              setParticipants(prev => prev.map(p => 
                p.id === msg.participant_id ? { ...p, speaking: msg.speaking } : p
              ))
              break
            default:
              break
          }
        } catch {
          // binary data already handled
        }
      }

      ws.onclose = (e) => {
        setStatus('disconnected')
        setRecording(false)
        setPipelineStage('idle')
        setTtsPlaying(false)
        ttsQueueRef.current = []
        setParticipants([])
        addLog({ text: `Disconnected (code=${e.code})`, event: 'info', ts: Date.now() })
      }

      ws.onerror = () => {
        setStatus('error')
        setPipelineStage('idle')
        addLog({ text: 'WebSocket error', event: 'error', ts: Date.now() })
      }

      wsRef.current = ws
    } catch (err) {
      setStatus('error')
      setPipelineStage('idle')
      addLog({ text: `Connection failed: ${err}`, event: 'error', ts: Date.now() })
    }
  }, [roomId, participantId, sourceLang, targetLang, addLog, playTtsAudio, ttsPlaying])

  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      localStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      ctxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        if (localMuted) return // Don't send audio when muted
        const input = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(input.length)
        for (let i = 0; i < input.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)))
        }
        wsRef.current.send(pcm16.buffer)
      }

      source.connect(processor)
      processor.connect(ctx.destination)

      procRef.current = processor
      setRecording(true)
      addLog({ text: 'Recording started', event: 'info', ts: Date.now() })
    } catch (err) {
      addLog({ text: `Mic error: ${err}`, event: 'error', ts: Date.now() })
    }
  }, [addLog, localMuted])

  const stopRecording = useCallback(() => {
    if (procRef.current && ctxRef.current) {
      procRef.current.disconnect()
      ctxRef.current.close()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    procRef.current = null
    ctxRef.current = null
    streamRef.current = null
    setRecording(false)
    addLog({ text: 'Recording stopped', event: 'info', ts: Date.now() })
  }, [addLog])

  const toggleLocalMute = useCallback(() => {
    setLocalMuted(prev => !prev)
    // Notify server about mute status change
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mute',
        muted: !localMuted
      }))
    }
  }, [localMuted])

  const disconnect = useCallback(() => {
    stopRecording()
    wsRef.current?.close()
    wsRef.current = null
    ttsQueueRef.current = []
    setParticipants([])
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [stopRecording])

  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  const langOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' },
  ]

  const targetLangOptions = langOptions.filter(l => l.value !== 'auto')

  const statusStyles: Record<Status, string> = {
    connected: 'status-badge status-connected',
    connecting: 'status-badge status-connecting',
    error: 'status-badge status-error',
    disconnected: 'status-badge status-disconnected',
  }

  const logStyles: Record<string, string> = {
    transcript: 'log-entry log-transcript',
    translation: 'log-entry log-translation',
    vad_end: 'log-entry log-vad',
    error: 'log-entry log-error',
    info: 'log-entry log-info',
  }

  const stageStyles: Record<PipelineStage, string> = {
    idle: 'bg-gray-700 text-gray-400',
    vad: 'bg-yellow-700 text-yellow-100',
    asr: 'bg-blue-700 text-blue-100',
    translate: 'bg-purple-700 text-purple-100',
    tts: 'bg-orange-700 text-orange-100',
    playing: 'bg-green-700 text-green-100 animate-pulse',
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Overlay isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <ParticipantPanel
        participants={participants}
        localParticipantId="local"
        onToggleMute={toggleMute}
        onClose={() => setSidebarOpen(false)}
      />
      
      <SettingsPanel
        settings={settings}
        onSettingsChange={onSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />
      
      <MeetingSummaryPanel
        logs={logs}
        onClose={() => setSummaryOpen(false)}
        onExport={(format) => {
          console.log('Export format:', format)
        }}
      />
      
      <Overlay isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Overlay isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      
      <main style={{ marginRight: sidebarOpen ? '288px' : '0', marginLeft: settingsOpen ? '320px' : '0', transition: 'margin 0.3s ease', minHeight: '100vh' }}>
        <header className="sticky top-0 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 z-20">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                aria-label={sidebarOpen ? 'Hide participants' : 'Show participants'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">VizTR Meet</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[status]}`}>
                {status}
              </span>
              <button 
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 1 9 21.94a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 1 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 1 1 1.51 1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1.51 1z" />
                </svg>
              </button>
              <button 
                onClick={() => setSummaryOpen(!summaryOpen)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                aria-label={summaryOpen ? 'Hide meeting summary' : 'Show meeting summary'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </button>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                aria-label={sidebarOpen ? 'Hide participants' : 'Show participants'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                <span className="text-sm text-gray-300">{user.name}</span>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                  aria-label="Logout"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
          {/* Pipeline Status Bar */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'vad', label: 'VAD', stage: 'vad' },
              { key: 'asr', label: 'ASR', stage: 'asr' },
              { key: 'translate', label: 'Translate', stage: 'translate' },
              { key: 'tts', label: 'TTS', stage: 'tts' },
              { key: 'playing', label: 'Playing', stage: 'playing' },
            ].map(({ key, label, stage }) => (
              <div
                key={key}
                className={`px-3 py-1 rounded text-sm font-medium ${stageStyles[pipelineStage === stage ? stage : 'idle']} transition-colors`}
              >
                {label}
              </div>
            ))}
            {ttsPlaying && (
              <div className="ml-auto px-3 py-1 rounded text-sm font-medium bg-green-700 text-green-100 animate-pulse">
                🔊 Playing
              </div>
            )}
          </div>

          {/* Waveform Visualizer */}
          <WaveformVisualizer 
            isRecording={recording} 
            isMuted={localMuted} 
            audioLevel={0} 
            className="mb-4"
          />

          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ width: '120px', color: 'var(--muted)', fontSize: '0.875rem' }}>Room</span>
              <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="room-1" />
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ width: '120px', color: 'var(--muted)', fontSize: '0.875rem' }}>Participant</span>
              <input value={participantId} onChange={e => setParticipantId(e.target.value)} placeholder="user-xxx" />
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ width: '120px', color: 'var(--muted)', fontSize: '0.875rem' }}>Source Lang</span>
              <select value={sourceLang} onChange={e => setSourceLang(e.target.value)}>
                {langOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ width: '120px', color: 'var(--muted)', fontSize: '0.875rem' }}>Target Lang</span>
              <select value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                {targetLangOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={connect} disabled={status === 'connected' || status === 'connecting'}>
              Connect
            </button>
            <button className={recording ? 'btn-danger' : 'btn-success'} onClick={recording ? stopRecording : startRecording} disabled={status !== 'connected'}>
              {recording ? 'STOP' : 'REC'}
            </button>
            <button 
              className={localMuted ? 'btn-danger' : 'btn-secondary'} 
              onClick={toggleLocalMute}
              disabled={status !== 'connected'}
            >
              {localMuted ? '🔇 Muted' : '🔊 Live'}
            </button>
            <button className="btn-secondary" onClick={disconnect} disabled={status === 'disconnected'}>
              Disconnect
            </button>
            <span className={statusStyles[status]}>{status}</span>
          </div>

          <div>
            {logs.map((log, i) => (
              <div key={i} className={logStyles[log.event] || 'log-entry log-info'}>
                <span className="log-time">{new Date(log.ts).toLocaleTimeString()}</span>
                {log.lang && <span className="log-lang">{log.lang}</span>}
                <span className="log-event">{log.event}</span>
                <span>{log.text}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
                Connect and start recording to see live transcripts and translations
              </p>
            )}
          </div>
          <InstallPrompt />
        </main>
      </main>
      <Overlay isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}

const langOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
]

const targetLangOptions = langOptions.filter(l => l.value !== 'auto')

const statusStyles: Record<Status, string> = {
  connected: 'status-badge status-connected',
  connecting: 'status-badge status-connecting',
  error: 'status-badge status-error',
  disconnected: 'status-badge status-disconnected',
}

const logStyles: Record<string, string> = {
  transcript: 'log-entry log-transcript',
  translation: 'log-entry log-translation',
  vad_end: 'log-entry log-vad',
  error: 'log-entry log-error',
  info: 'log-entry log-info',
}

const stageStyles: Record<PipelineStage, string> = {
  idle: 'bg-gray-700 text-gray-400',
  vad: 'bg-yellow-700 text-yellow-100',
  asr: 'bg-blue-700 text-blue-100',
  translate: 'bg-purple-700 text-purple-100',
  tts: 'bg-orange-700 text-orange-100',
  playing: 'bg-green-700 text-green-100 animate-pulse',
}

export default App