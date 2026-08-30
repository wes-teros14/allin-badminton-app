import { describe, expect, it } from 'vitest'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'

describe('formatDisplayName', () => {
  it('prefers the nickname', () => {
    expect(formatDisplayName('Alexis', 'alexis-cruz')).toBe('Alexis')
  })

  it('title-cases the slug when there is no nickname', () => {
    expect(formatDisplayName(null, 'alexis-cruz')).toBe('Alexis Cruz')
    expect(formatDisplayName('   ', 's1-wei-chen')).toBe('S1 Wei Chen')
  })
})

describe('disambiguateDisplayNames', () => {
  it('leaves unique names untouched', () => {
    const labels = disambiguateDisplayNames([
      { id: '1', nameSlug: 'alexis-cruz', displayName: 'Alexis' },
      { id: '2', nameSlug: 'bea-santos', displayName: 'Bea' },
    ])
    expect(labels.get('1')).toBe('Alexis')
    expect(labels.get('2')).toBe('Bea')
  })

  it('qualifies two players who share a nickname', () => {
    const labels = disambiguateDisplayNames([
      { id: '1', nameSlug: 'alexis-cruz', displayName: 'Alexis' },
      { id: '2', nameSlug: 'alexis-santos', displayName: 'Alexis' },
    ])
    expect(labels.get('1')).toBe('Alexis (Cruz)')
    expect(labels.get('2')).toBe('Alexis (Santos)')
  })

  it('qualifies when the shared nickname is nothing like the slug', () => {
    const labels = disambiguateDisplayNames([
      { id: '1', nameSlug: 'maria-cruz', displayName: 'Ate' },
      { id: '2', nameSlug: 'josefa-lim', displayName: 'Ate' },
    ])
    expect(labels.get('1')).toBe('Ate (Maria Cruz)')
    expect(labels.get('2')).toBe('Ate (Josefa Lim)')
  })

  it('matches case-insensitively when deciding what clashes', () => {
    const labels = disambiguateDisplayNames([
      { id: '1', nameSlug: 'alexis-cruz', displayName: 'Alexis' },
      { id: '2', nameSlug: 'alexis-santos', displayName: 'alexis' },
    ])
    expect(labels.get('1')).toBe('Alexis (Cruz)')
    expect(labels.get('2')).toBe('alexis (Santos)')
  })

  it('falls back to a numeric suffix when the qualifier still collides', () => {
    const labels = disambiguateDisplayNames([
      { id: '1', nameSlug: 'alexis', displayName: 'Alexis' },
      { id: '2', nameSlug: 'alexis-', displayName: 'Alexis' },
    ])
    expect(labels.get('1')).toBe('Alexis (Alexis)')
    expect(labels.get('2')).toBe('Alexis (Alexis 2)')
  })

  it('handles three-way clashes', () => {
    const labels = disambiguateDisplayNames([
      { id: '1', nameSlug: 'alexis-cruz', displayName: 'Alexis' },
      { id: '2', nameSlug: 'alexis-santos', displayName: 'Alexis' },
      { id: '3', nameSlug: 'alexis-lim', displayName: 'Alexis' },
    ])
    expect(new Set([labels.get('1'), labels.get('2'), labels.get('3')]).size).toBe(3)
  })

  it('returns a label for every player', () => {
    const players = [
      { id: '1', nameSlug: 'alexis-cruz', displayName: 'Alexis' },
      { id: '2', nameSlug: 'alexis-santos', displayName: 'Alexis' },
      { id: '3', nameSlug: 'bea-lim', displayName: 'Bea' },
    ]
    const labels = disambiguateDisplayNames(players)
    expect(labels.size).toBe(3)
  })
})
