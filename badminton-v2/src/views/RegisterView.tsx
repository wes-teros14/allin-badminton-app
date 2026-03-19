import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRegistration } from '@/hooks/useRegistration'

export function RegisterView() {
  const [searchParams] = useSearchParams()
  // After OAuth redirect, Supabase drops query params — restore token from sessionStorage
  const token = searchParams.get('token') ?? sessionStorage.getItem('registration_token')
  const { user, isLoading, isValidToken, isAlreadyRegistered, signIn, register } =
    useRegistration(token)

  if (isLoading) return <div className="p-6">Loading…</div>

  if (!isValidToken) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Registration Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Registration is closed. Contact the admin.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in with Google to register for this session.
            </p>
            <Button onClick={signIn} className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAlreadyRegistered) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Already Registered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You're already registered for this session.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Register for Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as: {user.email}</p>
          <Button onClick={register} className="w-full">
            Register
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegisterView
