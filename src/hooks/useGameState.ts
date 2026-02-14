import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpellType } from '../types';
import {
  MAX_HEALTH,
  SPELL_CONFIG,
  GLOBAL_SPELL_COOLDOWN_MS,
  PUNCH_DAMAGE,
  PUNCH_COOLDOWN_MS,
  SPELL_SHIELD_DURATION_MS,
} from '../types';

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'victory' | 'defeat' | 'draw';

export interface LocalGameState {
  phase: GamePhase;
  myHealth: number;
  opponentHealth: number;
  spellCooldownReadyAt: number;
  punchCooldownReadyAt: number;
  /** Shield spell: only blocks spell damage */
  mySpellShieldUntil: number;
  /** Block (boxer): hold gesture = blocking punches (no cooldown) */
  isBlocking: boolean;
  opponentSpellShieldUntil: number;
  opponentPunchBlockUntil: number;
  countdown: number;
  roundTimeLeft: number;
}

const ROUND_DURATION_MS = 90 * 1000;
const COUNTDOWN_SEC = 3;

interface UseGameStateOptions {
  /** Reserved for future use (e.g. offline vs online display) */
  online?: boolean;
}

export function useGameState(options: UseGameStateOptions = {}) {
  const { online = false } = options;
  const [state, setState] = useState<LocalGameState>({
    phase: 'idle',
    myHealth: MAX_HEALTH,
    opponentHealth: MAX_HEALTH,
    spellCooldownReadyAt: 0,
    punchCooldownReadyAt: 0,
    mySpellShieldUntil: 0,
    isBlocking: false,
    opponentSpellShieldUntil: 0,
    opponentPunchBlockUntil: 0,
    countdown: COUNTDOWN_SEC,
    roundTimeLeft: ROUND_DURATION_MS / 1000,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const roundTimerRef = useRef<number>(0);
  const countdownTimerRef = useRef<number>(0);

  const setOpponentHealth = useCallback((health: number) => {
    setState((s) => ({ ...s, opponentHealth: Math.max(0, Math.min(MAX_HEALTH, health)) }));
  }, []);

  const startCountdown = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: 'countdown',
      myHealth: MAX_HEALTH,
      opponentHealth: MAX_HEALTH,
      spellCooldownReadyAt: 0,
      punchCooldownReadyAt: 0,
      mySpellShieldUntil: 0,
      isBlocking: false,
      opponentSpellShieldUntil: 0,
      opponentPunchBlockUntil: 0,
      countdown: COUNTDOWN_SEC,
      roundTimeLeft: ROUND_DURATION_MS / 1000,
    }));
    let c = COUNTDOWN_SEC;
    countdownTimerRef.current = window.setInterval(() => {
      c -= 1;
      setState((s) => ({ ...s, countdown: c }));
      if (c <= 0) {
        window.clearInterval(countdownTimerRef.current);
        setState((s) => ({ ...s, phase: 'playing', countdown: 0 }));
        let t = ROUND_DURATION_MS / 1000;
        roundTimerRef.current = window.setInterval(() => {
          t -= 1;
          setState((s) => ({ ...s, roundTimeLeft: Math.max(0, t) }));
          if (t <= 0) window.clearInterval(roundTimerRef.current);
        }, 1000);
      }
    }, 1000);
  }, []);

  /** Spell damage to opponent: when !online we update locally; when online opponent sends health_update so we don't guess. */
  const applySpellDamageToOpponent = useCallback(
    (damage: number) => {
      if (online) return;
      const now = Date.now();
      setState((s) => {
        if (now < s.opponentSpellShieldUntil) return s;
        return { ...s, opponentHealth: Math.max(0, s.opponentHealth - damage) };
      });
    },
    [online]
  );

  /** Punch damage to opponent: when !online we update locally; when online opponent sends health_update. Shield or block cancels punch (0 damage). */
  const applyPunchDamageToOpponent = useCallback(
    (damage: number) => {
      if (online) return;
      const now = Date.now();
      setState((s) => {
        const blocked = now < s.opponentSpellShieldUntil || now < s.opponentPunchBlockUntil;
        const dmg = blocked ? 0 : damage;
        return {
          ...s,
          ...(now < s.opponentPunchBlockUntil ? { opponentPunchBlockUntil: 0 } : {}),
          opponentHealth: Math.max(0, s.opponentHealth - dmg),
        };
      });
    },
    [online]
  );

  const tryCastSpell = useCallback(
    (spell: SpellType): { success: boolean } => {
      const now = Date.now();
      if (state.phase !== 'playing') return { success: false };
      if (now < state.spellCooldownReadyAt) return { success: false };

      const config = SPELL_CONFIG[spell];
      setState((s) => ({
        ...s,
        spellCooldownReadyAt: now + GLOBAL_SPELL_COOLDOWN_MS,
        ...(spell === 'shield' ? { mySpellShieldUntil: now + SPELL_SHIELD_DURATION_MS } : {}),
      }));

      if (config.damage > 0) applySpellDamageToOpponent(config.damage);
      return { success: true };
    },
    [state.phase, state.spellCooldownReadyAt, applySpellDamageToOpponent]
  );

  const tryPunch = useCallback((): boolean => {
    const now = Date.now();
    if (state.phase !== 'playing') return false;
    if (now < state.punchCooldownReadyAt) return false;

    setState((s) => ({ ...s, punchCooldownReadyAt: now + PUNCH_COOLDOWN_MS }));
    applyPunchDamageToOpponent(PUNCH_DAMAGE);
    return true;
  }, [state.phase, state.punchCooldownReadyAt, applyPunchDamageToOpponent]);

  /** Set blocking (hold gesture = blocking). No cooldown; active while you hold. */
  const setBlocking = useCallback((active: boolean) => {
    setState((s) => (s.isBlocking === active ? s : { ...s, isBlocking: active }));
  }, []);

  /** Applies damage using latest state (shield/block). Calls onApplied(newHealth) so caller can send health_update. */
  const applyDamageToSelf = useCallback(
    (damage: number, isSpell: boolean, onApplied: (newHealth: number) => void) => {
      const now = Date.now();
      setState((prev) => {
        let newHealth: number;
        let nextState: LocalGameState;
        if (now < prev.mySpellShieldUntil) {
          newHealth = prev.myHealth; /* shield: immune to both spells and punches */
          nextState = prev;
        } else if (!isSpell && prev.isBlocking) {
          newHealth = prev.myHealth; /* block cancels punch; hold = no consume */
          nextState = prev;
        } else {
          newHealth = Math.max(0, prev.myHealth - damage);
          nextState = { ...prev, myHealth: newHealth };
        }
        queueMicrotask(() => onApplied(newHealth));
        return nextState;
      });
    },
    []
  );

  const setVictory = useCallback(() => {
    window.clearInterval(roundTimerRef.current);
    setState((s) => ({ ...s, phase: 'victory' }));
  }, []);
  const setDefeat = useCallback(() => {
    window.clearInterval(roundTimerRef.current);
    setState((s) => ({ ...s, phase: 'defeat' }));
  }, []);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.opponentHealth <= 0) setVictory();
    if (state.myHealth <= 0) setDefeat();
  }, [state.phase, state.myHealth, state.opponentHealth, setVictory, setDefeat]);

  useEffect(() => () => {
    window.clearInterval(roundTimerRef.current);
    window.clearInterval(countdownTimerRef.current);
  }, []);

  return {
    state,
    startCountdown,
    tryCastSpell,
    tryPunch,
    setBlocking,
    applyDamageToSelf,
    setOpponentHealth,
    setVictory,
    setDefeat,
  };
}
