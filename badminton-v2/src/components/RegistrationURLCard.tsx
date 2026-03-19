import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Invitation } from '@/hooks/useSession'

interface Props {
  invitation: Invitation
  playerCount?: number
}

export function RegistrationURLCard({ invitation, playerCount = 0 }: Props) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/register?token=${invitation.id}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Open</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground break-all">{url}</p>
        <Button variant="outline" onClick={handleCopy} className="w-full">
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <p className="text-sm text-muted-foreground">{playerCount} players registered</p>
      </CardContent>
    </Card>
  )
}
