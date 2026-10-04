import { Button } from '@/components/ui/button'

/**
 * Shown instead of an endless loading screen when the server does not answer
 * while signing in. On Oct 4 2026 the database stalled for ~80 minutes and
 * every phone sat on a spinner with no explanation (docs/qa-log.html).
 */
export function ConnectionProblem({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-3" role="alert">
        <h1 className="text-lg font-semibold">Can&apos;t reach the server</h1>
        <p className="text-sm text-muted-foreground">
          The app is up, but the database isn&apos;t answering right now. This is usually temporary.
          Your games and registrations are safe.
        </p>
        <Button onClick={onRetry} disabled={isRetrying} className="mt-2">
          {isRetrying ? 'Trying again…' : 'Try again'}
        </Button>
      </div>
    </main>
  )
}
