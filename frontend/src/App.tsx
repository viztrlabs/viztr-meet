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

function App() {
  const [roomId, setRoomId] = useState('room-1')
  const [participantId, setParticipantId] = useState(() => `user-${Math.random().toString(36).slice(2, 6)}`)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('en')
  const [status, setStatus] = useState<Status>('disconnected')
  const [recording, setRecording] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 200))
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
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
        try {
          const msg = JSON.parse(ev.data)
          addLog({ text: msg.text, lang: msg.lang, event: msg.event, ts: Date.now() })
        } catch {
          // binary data
        }
      }

      ws.onclose = (e) => {
        setStatus('disconnected')
        setRecording(false)
        addLog({ text: `Disconnected (code=${e.code})`, event: 'info', ts: Date.now() })
      }

      ws.onerror = () => {
        setStatus('error')
        addLog({ text: 'WebSocket error', event: 'error', ts: Date.now() })
      }

      wsRef.current = ws
    } catch (err) {
      setStatus('error')
      addLog({ text: `Connection failed: ${err}`, event: 'error', ts: Date.now() })
    }
  }, [roomId, participantId, sourceLang, targetLang, addLog])

  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      ctxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
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
  }, [addLog])

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

  const disconnect = useCallback(() => {
    stopRecording()
    wsRef.current?.close()
    wsRef.current = null
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

  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>VizTR Meet</h1>

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
  )
}

export default App