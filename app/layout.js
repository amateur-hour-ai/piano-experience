import './globals.css'
import NavBar from './NavBar'
import ToastProvider from './ToastProvider'

export const metadata = {
  title: 'Piano Experience',
  description: 'A practice companion for piano students',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <NavBar />
          <div style={{ minHeight: '100vh', background: '#eff6ff' }}>
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
