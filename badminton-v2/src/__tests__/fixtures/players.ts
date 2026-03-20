import type { PlayerInput } from '@/lib/matchGenerator'

/** FIXTURE_A — 4 males, all level 5. Minimal viable session. */
export const FIXTURE_A: PlayerInput[] = [
  { id: 'a1', nameSlug: 'alice', nickname: null, gender: 'M', level: 5 },
  { id: 'a2', nameSlug: 'bob',   nickname: null, gender: 'M', level: 5 },
  { id: 'a3', nameSlug: 'carol', nickname: null, gender: 'M', level: 5 },
  { id: 'a4', nameSlug: 'dave',  nickname: null, gender: 'M', level: 5 },
]

/** FIXTURE_B — 4M + 4F, levels 3–8. Standard mixed session. */
export const FIXTURE_B: PlayerInput[] = [
  { id: 'b1', nameSlug: 'alice', nickname: null, gender: 'M', level: 3 },
  { id: 'b2', nameSlug: 'bob',   nickname: null, gender: 'M', level: 5 },
  { id: 'b3', nameSlug: 'carol', nickname: null, gender: 'M', level: 7 },
  { id: 'b4', nameSlug: 'dave',  nickname: null, gender: 'M', level: 8 },
  { id: 'b5', nameSlug: 'eve',   nickname: null, gender: 'F', level: 3 },
  { id: 'b6', nameSlug: 'faye',  nickname: null, gender: 'F', level: 5 },
  { id: 'b7', nameSlug: 'grace', nickname: null, gender: 'F', level: 6 },
  { id: 'b8', nameSlug: 'hana',  nickname: null, gender: 'F', level: 8 },
]

/** FIXTURE_C — 6 males, wide spread (levels 1,2,3,7,9,10). Spread filter stress. */
export const FIXTURE_C: PlayerInput[] = [
  { id: 'c1', nameSlug: 'p1', nickname: null, gender: 'M', level: 1  },
  { id: 'c2', nameSlug: 'p2', nickname: null, gender: 'M', level: 2  },
  { id: 'c3', nameSlug: 'p3', nickname: null, gender: 'M', level: 3  },
  { id: 'c4', nameSlug: 'p4', nickname: null, gender: 'M', level: 7  },
  { id: 'c5', nameSlug: 'p5', nickname: null, gender: 'M', level: 9  },
  { id: 'c6', nameSlug: 'p6', nickname: null, gender: 'M', level: 10 },
]

/** FIXTURE_D — 5 males, all level 5. Streak reset stress (always 1 resting). */
export const FIXTURE_D: PlayerInput[] = [
  { id: 'd1', nameSlug: 'p1', nickname: null, gender: 'M', level: 5 },
  { id: 'd2', nameSlug: 'p2', nickname: null, gender: 'M', level: 5 },
  { id: 'd3', nameSlug: 'p3', nickname: null, gender: 'M', level: 5 },
  { id: 'd4', nameSlug: 'p4', nickname: null, gender: 'M', level: 5 },
  { id: 'd5', nameSlug: 'p5', nickname: null, gender: 'M', level: 5 },
]

/** FIXTURE_E — 6 players with null gender. Auto-disable gender rules. */
export const FIXTURE_E: PlayerInput[] = [
  { id: 'e1', nameSlug: 'p1', nickname: null, gender: null, level: 5 },
  { id: 'e2', nameSlug: 'p2', nickname: null, gender: null, level: 5 },
  { id: 'e3', nameSlug: 'p3', nickname: null, gender: null, level: 5 },
  { id: 'e4', nameSlug: 'p4', nickname: null, gender: null, level: 5 },
  { id: 'e5', nameSlug: 'p5', nickname: null, gender: null, level: 5 },
  { id: 'e6', nameSlug: 'p6', nickname: null, gender: null, level: 5 },
]

/** FIXTURE_F — 6M + 6F, levels 2–9. Large session, balance pass stress. */
export const FIXTURE_F: PlayerInput[] = [
  { id: 'f1',  nameSlug: 'p1',  nickname: null, gender: 'M', level: 2 },
  { id: 'f2',  nameSlug: 'p2',  nickname: null, gender: 'M', level: 4 },
  { id: 'f3',  nameSlug: 'p3',  nickname: null, gender: 'M', level: 5 },
  { id: 'f4',  nameSlug: 'p4',  nickname: null, gender: 'M', level: 6 },
  { id: 'f5',  nameSlug: 'p5',  nickname: null, gender: 'M', level: 8 },
  { id: 'f6',  nameSlug: 'p6',  nickname: null, gender: 'M', level: 9 },
  { id: 'f7',  nameSlug: 'p7',  nickname: null, gender: 'F', level: 2 },
  { id: 'f8',  nameSlug: 'p8',  nickname: null, gender: 'F', level: 4 },
  { id: 'f9',  nameSlug: 'p9',  nickname: null, gender: 'F', level: 5 },
  { id: 'f10', nameSlug: 'p10', nickname: null, gender: 'F', level: 6 },
  { id: 'f11', nameSlug: 'p11', nickname: null, gender: 'F', level: 7 },
  { id: 'f12', nameSlug: 'p12', nickname: null, gender: 'F', level: 9 },
]
