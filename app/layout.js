import './globals.css'
import NavBar from './NavBar'
import ToastProvider from './ToastProvider'
import ActiveProfileProvider from '@/lib/useActiveProfile'
import OfflineProvider from '@/lib/useOffline'
import ServiceWorkerRegistrar from './ServiceWorkerRegistrar'
import BackgroundCacher from './BackgroundCacher'

export const metadata = {
  title: 'Piano Experience',
  description: 'A practice companion for piano students',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Piano Experience',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Piano Experience" />
      </head>
      <body>
        <ToastProvider>
          <OfflineProvider>
            <ActiveProfileProvider>
              <NavBar />
              <div style={{ minHeight: '100vh', background: '#eff6ff', paddingBottom: '40px' }}>
                {children}
              </div>
              <ServiceWorkerRegistrar />
              <BackgroundCacher />
            </ActiveProfileProvider>
          </OfflineProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
