interface Props {
  url: string | null
  name: string
  size?: number
  className?: string
}

export function Avatar({ url, name, size = 32, className = '' }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
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
      className={`rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold shrink-0 ${className}`}
      style={{ width: dim, height: dim, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  )
}
