import type { PlayerInput } from './matchGenerator'

export interface RegistrationRow {
  player_id: string
  gender: 'M' | 'F' | null
  level: number | null
}

export interface ProfileRow {
  id: string
  name_slug: string
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null
}

/** Registration override ?? profile value — the roster the Match Generator schedules. */
export function buildRegisteredPlayers(
  registrations: RegistrationRow[],
  profiles: ProfileRow[]
): PlayerInput[] {
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  return registrations.map((r) => {
    const profile = profileMap.get(r.player_id)
    return {
      id: r.player_id,
      nameSlug: profile?.name_slug ?? r.player_id,
      nickname: profile?.nickname ?? null,
      gender: (r.gender ?? profile?.gender ?? null) as 'M' | 'F' | null,
      level: r.level ?? profile?.level ?? null,
    }
  })
}
