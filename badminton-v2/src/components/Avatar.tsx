interface Props {
  url: string | null
  name: string
  size?: number
  className?: string
}

/**
 * The fallback used to be `bg-muted` with a `text-muted-foreground` initial, so
 * every player without a photo rendered as the same grey disc — and every Ana,
 * Ate and Alex collapsed onto the same letter. On the match board, which leads
 * with four 48px faces, that turned half a card into identical blanks.
 *
 * A hue derived from the name gives each of them a stable identity instead. 32%
 * lightness is deliberate: it is the darkest the scale needs to be so that white
 * text clears 4.5:1 at the *lightest* hues (yellow-green, around 60deg, is the
 * worst case at 4.78:1). Anything lighter fails there.
 */
function hueFromName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360
  }
  return hash
}

export function Avatar({ url, name, size = 32, className = '' }: Props) {
  const trimmed = name.trim()
  const initial = trimmed.charAt(0).toUpperCase() || '?'
  const dim = `${size}px`

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: dim, height: dim }}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{
        width: dim,
        height: dim,
        fontSize: size * 0.45,
        backgroundColor: `hsl(${hueFromName(trimmed || '?')} 45% 32%)`,
      }}
    >
      {initial}
    </div>
  )
}
