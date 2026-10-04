import { describe, expect, it } from 'vitest'
import { baseProfileSlug, profileDisplayName } from '@/lib/profileSlug'

describe('baseProfileSlug', () => {
  it('matches the handle_new_user trigger for an ordinary Google name', () => {
    expect(baseProfileSlug('Wes Teros')).toBe('wes-teros')
  })

  it('strips punctuation and accents the trigger also strips', () => {
    expect(baseProfileSlug("José O'Neil-Cruz!")).toBe('jos-oneil-cruz')
  })

  it('collapses runs of spaces into one hyphen', () => {
    expect(baseProfileSlug('Ana   Maria Lim')).toBe('ana-maria-lim')
  })

  it('deletes a tab rather than hyphenating it, exactly as the trigger does', () => {
    // The trigger strips [^a-zA-Z0-9 -] before collapsing whitespace, and a tab
    // is not in that set — so the app must drop it too or the two disagree.
    expect(baseProfileSlug('Maria\tLim')).toBe('marialim')
  })

  it('trims leading and trailing hyphens', () => {
    expect(baseProfileSlug(' -Ana- ')).toBe('ana')
  })

  it('falls back to "user" when nothing usable is left', () => {
    expect(baseProfileSlug('李小龍')).toBe('user')
    expect(baseProfileSlug('')).toBe('user')
    expect(baseProfileSlug(null)).toBe('user')
  })
})

describe('profileDisplayName', () => {
  it('prefers the Google name, as the trigger does', () => {
    expect(profileDisplayName({ name: 'Ana Lim', full_name: 'Ana B. Lim' }, 'ana@x.com')).toBe('Ana Lim')
  })

  it('falls back to full_name, then the email local part', () => {
    expect(profileDisplayName({ full_name: 'Ana B. Lim' }, 'ana@x.com')).toBe('Ana B. Lim')
    expect(profileDisplayName({}, 'mwca8888@gmail.com')).toBe('mwca8888')
  })

  it('ignores a blank name', () => {
    expect(profileDisplayName({ name: '   ' }, 'ana@x.com')).toBe('ana')
  })

  it('returns null with no name and no email', () => {
    expect(profileDisplayName(undefined, undefined)).toBeNull()
  })
})
