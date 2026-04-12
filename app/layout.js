import './globals.css'
import NavBar from './NavBar'
import ToastProvider from './ToastProvider'
import ActiveProfileProvider from '@/lib/useActiveProfile'

export const metadata = {
  title: 'Piano Experience',
  description: 'A practice companion for piano students',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <ActiveProfileProvider>
            <NavBar />
            <div style={{ minHeight: '100vh', background: '#eff6ff' }}>
              {children}
            </div>
          </ActiveProfileProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
