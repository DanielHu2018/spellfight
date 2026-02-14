/** Spell types – distinct gestures, no overlap */
export type SpellType = 'firebreath' | 'shield';

/** Recognized gesture: spells + punch, block */
export type GestureType = SpellType | 'punch' | 'block' | 'none';

export const SPELL_CONFIG: Record<
  SpellType,
  { damage: number; heal: number; blocks: SpellType[] }
> = {
  firebreath: { damage: 12, heal: 0, blocks: [] },
  shield: { damage: 0, heal: 0, blocks: ['firebreath'] },
};

/** One cooldown for all spells: can only use one spell every 8 seconds */
export const GLOBAL_SPELL_COOLDOWN_MS = 8000;

export const PUNCH_DAMAGE = 5;
export const PUNCH_COOLDOWN_MS = 800;

/** Shield (spell): duration of spell immunity; only blocks spells */
export const SPELL_SHIELD_DURATION_MS = 3000;
/** Block (boxer): duration of punch block; only blocks punches. Must be >= telegraph so blocking when you see the arrow still counts when punch lands. */
export const PUNCH_BLOCK_DURATION_MS = 2200;
export const PUNCH_BLOCK_DAMAGE_REDUCTION = 0.5;

export const MAX_HEALTH = 100;

/** Game phase for match flow */
export type MatchPhase =
  | 'idle'
  | 'countdown'
  | 'playing'
  | 'victory'
  | 'defeat'
  | 'draw'
  | 'disconnected';

export interface PlayerState {
  health: number;
  maxHealth: number;
}

/** Event sent over P2P (for Phase 2) */
export interface GameEvent {
  type: 'spell_cast' | 'punch' | 'block' | 'health_update' | 'match_start' | 'match_end' | 'heartbeat';
  spell?: SpellType;
  timestamp: number;
  sequence?: number;
  payload?: unknown;
}

/** Hand landmark from MediaPipe (normalized x,y,z) */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
}
