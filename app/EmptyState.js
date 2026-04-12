'use client'

export default function EmptyState({ icon, message, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', color: '#666', border: '1px solid #e5e7eb' }}>
      {icon && <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>{icon}</div>}
      <p style={{ fontSize: '15px', lineHeight: '1.6' }}>{message}</p>
      {children && <div style={{ marginTop: '12px' }}>{children}</div>}
    </div>
  )
}

export function Skeleton({ rows = 3, height = 60 }) {
  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: `${height}px`, marginBottom: '12px' }} />
      ))}
    </div>
  )
}
