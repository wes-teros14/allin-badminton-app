/**
 * Settings card for the court announcer's fixed words: "Court", "Game", the numbers
 * 1–9, "and", "versus". Players' names are recorded on the Players page; these
 * join them into "Court … 2 … AJ … and … Jaz … versus … Sim … and … Kurt".
 * Each saves on its own, like the other cards below the Save button.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipRecorder } from '@/components/ClipRecorder'
import { useAnnouncerClips } from '@/hooks/useAnnouncerClips'
import { ANNOUNCER_COURT_NUMBERS, PHRASE_KEYS } from '@/lib/announcer'

const PHRASES: Array<{ key: string; label: string }> = [
  { key: PHRASE_KEYS.court, label: 'Court' },
  { key: PHRASE_KEYS.game, label: 'Game' },
  ...ANNOUNCER_COURT_NUMBERS.map((n) => ({ key: PHRASE_KEYS.number(n), label: String(n) })),
  { key: PHRASE_KEYS.and, label: 'and' },
  { key: PHRASE_KEYS.versus, label: 'versus' },
]

export function AnnouncerPhrasesCard() {
  const { clips, isLoading, loadError, save, remove } = useAnnouncerClips()
  const recorded = PHRASES.filter((p) => clips.has(p.key)).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Announcer words</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The live board calls each new game, e.g. “Court 2 … AJ and Jaz … versus … Sim and Kurt”. Record
          these once; record names on the Players page. A word that isn’t recorded is read by the tablet’s
          computer voice.
        </p>

        {isLoading ? (
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
        ) : loadError ? (
          <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">Couldn’t load the recordings</p>
            <p className="break-words text-xs text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground tabular-nums">{recorded} of {PHRASES.length} recorded</p>
            <ul className="divide-y divide-border">
              {PHRASES.map((phrase) => (
                <li key={phrase.key} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium text-foreground">“{phrase.label}”</span>
                  <ClipRecorder
                    label={phrase.label}
                    clip={clips.get(phrase.key)}
                    onSave={(wav) => save(phrase.key, wav)}
                    onDelete={() => remove(phrase.key)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default AnnouncerPhrasesCard
