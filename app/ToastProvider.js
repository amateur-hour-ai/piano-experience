'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function useToast() {
  return useContext(ToastContext)
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    info: { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' },
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.success
          return (
            <div key={t.id} style={{
              padding: '12px 16px', background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: '8px', color: c.text, fontSize: '14px', fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              animation: 'slideIn 0.25s ease-out'
            }}>
              {t.type === 'success' && '✓ '}{t.type === 'error' && '✗ '}{t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
