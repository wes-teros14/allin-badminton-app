import { useTheme } from '@/contexts/ThemeContext'

/**
 * One object in two states, not two icons crossfading: `.theme-orb` in
 * `index.css` grows the crescent into a full disc and throws eight rays out of
 * the same element, so nothing pops in or out mid-transition.
 *
 * The orb shows the theme you are *in*, so the action lives in `aria-label`
 * rather than the icon. `currentColor` is deliberate — dropped onto the purple
 * nav bar this has to inherit white, not `--foreground`.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="theme-orb" aria-hidden="true" />
    </button>
  )
}

export default ThemeToggle
