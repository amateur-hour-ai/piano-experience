'use client'

import Link from 'next/link'
import { useOffline } from '@/lib/useOffline'

// When online: uses Next.js <Link> for fast client-side navigation
// When offline: uses plain <a> tag for full page load via Service Worker
export default function OfflineLink({ href, children, ...props }) {
  const { isOnline } = useOffline()

  if (!isOnline) {
    return <a href={href} {...props}>{children}</a>
  }

  return <Link href={href} {...props}>{children}</Link>
}
