import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'

vi.useFakeTimers()

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    global.WebSocket = vi.fn().mockImplementation(() => ({
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn(),
    }))
    global.AudioContext = vi.fn().mockImplementation(() => ({
      sampleRate: 16000,
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
      }),
      createScriptProcessor: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
      }),
      close: vi.fn(),
      destination: {},
    }))
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
      }),
    }
    global.Int16Array = vi.fn().mockImplementation((arr) => arr)
  })

  it('renders main UI elements', () => {
    render(<App />)
    expect(screen.getByText('VizTR Meet')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('room-1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('user-xxx')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('REC')).toBeInTheDocument()
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('shows disconnected status initially', () => {
    render(<App />)
    expect(screen.getByText('disconnected')).toBeInTheDocument()
  })

  it('enables Connect button when not connected', () => {
    render(<App />)
    const connectBtn = screen.getByText('Connect')
    expect(connectBtn).not.toBeDisabled()
  })

  it('disables REC button when disconnected', () => {
    render(<App />)
    const recBtn = screen.getByText('REC')
    expect(recBtn).toBeDisabled()
  })

  it('calls fetch on Connect click', async () => {
    const mockWs = {
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn(),
    }
    global.WebSocket = vi.fn().mockImplementation(() => mockWs)
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        token: 'test-token',
        ws_url: 'ws://localhost:8000/audio/stream'
      })
    })

    render(<App />)
    fireEvent.click(screen.getByText('Connect'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audio/token')
      )
    })
  })

  it('renders language selectors', () => {
    render(<App />)
    const sourceSelect = screen.getByRole('combobox', { name: /Source Lang/i })
    const targetSelect = screen.getByRole('combobox', { name: /Target Lang/i })
    expect(sourceSelect).toBeInTheDocument()
    expect(targetSelect).toBeInTheDocument()
  })

  it('shows empty state when no logs', () => {
    render(<App />)
    expect(screen.getByText(/Connect and start recording/)).toBeInTheDocument()
  })
})

describe('Audio processing', () => {
  it('converts float32 to Int16Array', () => {
    const input = new Float32Array([0.5, -0.5, 0, 1, -1])
    const pcm16 = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)))
    }
    expect(pcm16[0]).toBe(16384)
    expect(pcm16[1]).toBe(-16384)
    expect(pcm16[2]).toBe(0)
    expect(pcm16[3]).toBe(32767)
    expect(pcm16[4]).toBe(-32768)
  })
})

describe('Log entry formatting', () => {
  it('formats timestamp correctly', () => {
    const date = new Date('2024-01-15T10:30:45.123Z')
    const timeStr = date.toLocaleTimeString()
    expect(timeStr).toContain(':')
  })
})