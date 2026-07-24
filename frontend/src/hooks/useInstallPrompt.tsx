import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      setCanInstall(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return false

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setCanInstall(false)
      setIsInstalled(true)
      return true
    }
    return false
  }, [deferredPrompt])

  return { canInstall, isInstalled, install }
}

export function InstallPrompt() {
  const { canInstall, isInstalled, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (isInstalled || !canInstall || dismissed) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      right: 20,
      maxWidth: 400,
      margin: '0 auto',
      zIndex: 9999,
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div className="bg-gray-900 border border-blue-500 rounded-xl p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-white">Install VizTR Meet</h3>
            <p className="text-sm text-gray-300 mt-1">
              Add to home screen for offline access and faster loading
            </p>
          </div>
          <button
            onClick={install}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-200 p-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}