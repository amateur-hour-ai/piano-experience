import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = req.nextUrl.pathname === '/login'
  const isAuthRoute = req.nextUrl.pathname.startsWith('/auth')
  const isApiRoute = req.nextUrl.pathname.startsWith('/api')
  const isPublicFile = req.nextUrl.pathname.startsWith('/_next') || req.nextUrl.pathname.includes('.')

  if (isPublicFile || isApiRoute || isAuthRoute) return res

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
}
