import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ViewModeProvider } from './contexts/ViewModeContext'

// Error boundary to catch crashes
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('App crashed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong</h1>
          <details style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '10px', marginTop: '10px' }}>
            {this.state.error?.toString()}
            {this.state.error?.stack}
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

console.log('Todoless starting...')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ViewModeProvider>
          <App />
        </ViewModeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('✓ SW registered:', registration.scope)
        
        // Check for updates every 60 seconds
        setInterval(() => {
          registration.update()
        }, 60000)
      })
      .catch((err) => {
        console.log('✗ SW registration failed:', err)
      })
  })
}

// Basic daily reminder at 08:00 using Notifications API (best-effort, non-persistent)
async function scheduleDailyReminder() {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') await Notification.requestPermission()
    if (Notification.permission !== 'granted') return
    const now = new Date()
    const target = new Date()
    target.setHours(8, 0, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const delay = target.getTime() - now.getTime()
    setTimeout(() => {
      new Notification("Today's Tasks", {
        body: 'Open Todoless to review tasks due today.',
        tag: 'daily-reminder',
      })
      // Re-schedule next day
      scheduleDailyReminder()
    }, Math.min(delay, 2147483647)) // clamp to max setTimeout
  } catch {}
}

scheduleDailyReminder()
