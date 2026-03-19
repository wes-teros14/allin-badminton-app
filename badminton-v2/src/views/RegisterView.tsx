import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRegistration } from '@/hooks/useRegistration'

function isInAppBrowser() {
  const ua = navigator.userAgent
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Line\/|MicroMessenger|Snapchat/i.test(ua)
}

export function RegisterView() {
  const [searchParams] = useSearchParams()

  if (isInAppBrowser()) {
    const currentUrl = window.location.href
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader><CardTitle>Open in Browser</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Google sign-in doesn't work inside Messenger or other apps.
            </p>
            <p className="text-sm text-muted-foreground">
              Please open this link in <strong>Chrome</strong> or <strong>Safari</strong> to register.
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(currentUrl).catch(() => {})}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Copy Link
            </button>
            <p className="text-xs text-center text-muted-foreground">Then paste it in Chrome or Safari</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  // After OAuth redirect, Supabase drops query params — restore token from sessionStorage
  const token = searchParams.get('token') ?? localStorage.getItem('registration_token')
  console.log('[Register] token from URL:', searchParams.get('token'))
  console.log('[Register] token from localStorage:', localStorage.getItem('registration_token'))
  console.log('[Register] token used:', token)
  const { user, isLoading, isValidToken, isAlreadyRegistered, isFull, signIn, register } =
    useRegistration(token)

  // No token in URL at all — definitely closed
  if (!token) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader><CardTitle>Registration Closed</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Registration is closed. Contact the admin.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Token present but not signed in — prompt sign-in (validate after OAuth)
  if (!user) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader><CardTitle>Sign in to Register</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Sign in with Google to register for this session.</p>
            <Button onClick={signIn} className="w-full">Sign in with Google</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) return <div className="p-6">Loading…</div>

  if (!isValidToken) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader><CardTitle>Registration Closed</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Registration is closed. Contact the admin.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isFull) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader><CardTitle>Session Full</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Registration is full. Contact the admin.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAlreadyRegistered) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader><CardTitle>You're registered!</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Thank you for registering and see you at the court! :)</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <Card>
        <CardHeader><CardTitle>Register for Session</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as: {user.email}</p>
          <Button onClick={register} className="w-full">Register</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegisterView
