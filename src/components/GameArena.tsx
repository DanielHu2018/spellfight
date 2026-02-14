import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataConnection } from 'peerjs';
import { useHandTracker } from '../hooks/useHandTracker';
import { useGameState } from '../hooks/useGameState';
import { SPELL_CONFIG, PUNCH_DAMAGE } from '../types';
import type { ActionType } from './SpellEffects';
import { SpellEffects } from './SpellEffects';
import styles from './GameArena.module.css';

const CAST_LOCK_MS = 600;
/** Block requires higher confidence to avoid accidental triggers (stricter than general 0.55) */
const BLOCK_CONFIDENCE_MIN = 0.72;
/** Time the defender has to see the attack and respond (DDR/Just Dance style) */
const TELEGRAPH_MS = 1800;

interface IncomingAttack {
  id: number;
  type: 'firebreath' | 'punch';
  landsAt: number;
}

/** Events sent over P2P data channel */
type GameEvent =
  | { type: 'spell_cast'; spell: 'firebreath' }
  | { type: 'punch' }
  | { type: 'health_update'; health: number };

interface GameArenaProps {
  stream: MediaStream;
  connection: DataConnection | null;
  remoteStream: MediaStream | null;
  onStartVideoCall: (stream: MediaStream) => void;
  onExit: () => void;
  /** When true (client), mirror layout so side-by-side windows are congruent */
  layoutMirror?: boolean;
}

export function GameArena({ stream, connection, remoteStream, onStartVideoCall, onExit, layoutMirror = false }: GameArenaProps) {
  const { videoRef, status, gesture, confidence, fps, start, stop } = useHandTracker();
  const { state, startCountdown, tryCastSpell, tryPunch, setBlocking, applyDamageToSelf, setOpponentHealth, setVictory } = useGameState({
    online: !!connection,
  });
  const [recentCasts, setRecentCasts] = useState<Array<{ action: ActionType; side: 'me' | 'opponent'; at: number }>>([]);
  const [incomingAttacks, setIncomingAttacks] = useState<IncomingAttack[]>([]);
  const [, setTick] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const castLockRef = useRef<number>(0);
  const incomingIdRef = useRef(0);
  const hadConnectionRef = useRef(false);
  const opponentVideoRef = useRef<HTMLVideoElement>(null);
  const applyDamageToSelfRef = useRef(applyDamageToSelf);
  const setOpponentHealthRef = useRef(setOpponentHealth);
  applyDamageToSelfRef.current = applyDamageToSelf;
  setOpponentHealthRef.current = setOpponentHealth;

  const sendEvent = useCallback(
    (event: GameEvent) => {
      if (connection) {
        try {
          connection.send(event);
        } catch (_e) {
          // connection may not be open yet; PeerJS will log
        }
      }
    },
    [connection]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    start();
    startCountdown();
    return () => stop();
  }, [stream, start, stop, startCountdown]);

  useEffect(() => {
    if (connection?.open && stream) {
      onStartVideoCall(stream);
    }
  }, [connection, stream, onStartVideoCall]);

  useEffect(() => {
    const video = opponentVideoRef.current;
    if (video && remoteStream) {
      video.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (connection) hadConnectionRef.current = true;
  }, [connection]);

  const sendRef = useRef<(event: GameEvent) => void>(() => {});
  const incomingAttacksRef = useRef<IncomingAttack[]>([]);
  incomingAttacksRef.current = incomingAttacks;

  useEffect(() => {
    if (!connection) return;
    const send = (event: GameEvent) => {
      try {
        connection.send(event);
      } catch (_) {}
    };
    sendRef.current = send;
    const handleData = (data: unknown) => {
      const raw = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
      const ev = (raw ?? data) as GameEvent;
      const setOpp = setOpponentHealthRef.current;
      if (ev?.type === 'spell_cast' && ev.spell === 'firebreath') {
        const id = ++incomingIdRef.current;
        setIncomingAttacks((prev) => [...prev, { id, type: 'firebreath', landsAt: Date.now() + TELEGRAPH_MS }]);
      } else if (ev?.type === 'punch') {
        const id = ++incomingIdRef.current;
        setIncomingAttacks((prev) => [...prev, { id, type: 'punch', landsAt: Date.now() + TELEGRAPH_MS }]);
      } else if (ev?.type === 'health_update' && typeof ev.health === 'number') {
        setOpp(ev.health);
      }
    };
    connection.on('data', handleData);
    return () => {
      connection.off('data', handleData);
    };
  }, [connection]);

  useEffect(() => {
    if (state.phase !== 'playing') {
      setBlocking(false);
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const current = incomingAttacksRef.current;
      if (current.length > 0) setTick((t) => t + 1);
      const toResolve = current.filter((a) => now >= a.landsAt);
      if (toResolve.length === 0) return;
      const apply = applyDamageToSelfRef.current;
      const send = sendRef.current;
      toResolve.forEach((a) => {
        const damage = a.type === 'firebreath' ? SPELL_CONFIG.firebreath.damage : PUNCH_DAMAGE;
        const isSpell = a.type === 'firebreath';
        apply(damage, isSpell, (newHealth) => {
          setRecentCasts((c) => [...c.slice(-6), { action: a.type, side: 'opponent', at: now }]);
          send({ type: 'health_update', health: newHealth });
        });
      });
      setIncomingAttacks((prev) => prev.filter((a) => !toResolve.some((r) => r.id === a.id)));
    }, 50);
    return () => clearInterval(interval);
  }, [state.phase]);

  useEffect(() => {
    if (connection) return;
    if (!hadConnectionRef.current) return;
    if (state.phase === 'playing') {
      setVictory();
    } else if (state.phase === 'countdown') {
      setConnectionLost(true);
    }
  }, [connection, state.phase, setVictory]);

  /** Block is active only while the block gesture is held (no cooldown). Run independently so we always update when gesture/confidence change, even when gesture is 'none'. */
  useEffect(() => {
    setBlocking(
      state.phase === 'playing' &&
        gesture === 'block' &&
        confidence >= BLOCK_CONFIDENCE_MIN
    );
  }, [state.phase, gesture, confidence, setBlocking]);

  useEffect(() => {
    if (state.phase !== 'playing' || gesture === 'none' || confidence < 0.55) return;
    const now = Date.now();
    if (now < castLockRef.current) return;

    const spellReady = now >= state.spellCooldownReadyAt;

    if (gesture === 'firebreath' && spellReady) {
      if (tryCastSpell('firebreath').success) {
        castLockRef.current = now + CAST_LOCK_MS;
        setRecentCasts((c) => [...c.slice(-6), { action: 'firebreath', side: 'me', at: now }]);
        sendEvent({ type: 'spell_cast', spell: 'firebreath' });
      }
      return;
    }
    if (gesture === 'shield' && spellReady) {
      if (tryCastSpell('shield').success) {
        castLockRef.current = now + CAST_LOCK_MS;
        setRecentCasts((c) => [...c.slice(-6), { action: 'shield', side: 'me', at: now }]);
      }
      return;
    }
    if (gesture === 'punch') {
      if (tryPunch()) {
        castLockRef.current = now + CAST_LOCK_MS;
        setRecentCasts((c) => [...c.slice(-6), { action: 'punch', side: 'me', at: now }]);
        sendEvent({ type: 'punch' });
      }
      return;
    }
  }, [state.phase, state.spellCooldownReadyAt, gesture, confidence, tryCastSpell, tryPunch, sendEvent]);

  const spellCooldownRem = () => {
    const now = Date.now();
    if (now >= state.spellCooldownReadyAt) return 0;
    return Math.ceil((state.spellCooldownReadyAt - now) / 1000);
  };
  const punchCooldownRem = () => {
    const now = Date.now();
    if (now >= state.punchCooldownReadyAt) return 0;
    return Math.ceil((state.punchCooldownReadyAt - now) / 1000);
  };

  const now = Date.now();
  const isPunchBlocking = state.phase === 'playing' && state.isBlocking;
  const isSpellShield = state.phase === 'playing' && now < state.mySpellShieldUntil;

  return (
    <div className={styles.arenaWrap}>
      <div className={`${styles.arena} ${layoutMirror ? styles.arenaMirror : ''}`}>
      <div className={styles.hud}>
        <div className={styles.healthRow}>
          <div className={styles.healthBlock}>
            <span className={styles.label}>You</span>
            <div className={styles.healthBar}>
              <div
                className={styles.healthFill}
                style={{ width: `${(state.myHealth / 100) * 100}%` }}
              />
            </div>
            <span className={styles.healthNum}>{state.myHealth}</span>
          </div>
          <div className={styles.healthBlock}>
            <span className={styles.label}>Opponent</span>
            <div className={styles.healthBar}>
              <div
                className={styles.healthFillOpponent}
                style={{ width: `${(state.opponentHealth / 100) * 100}%` }}
              />
            </div>
            <span className={styles.healthNum}>{state.opponentHealth}</span>
          </div>
        </div>
        {state.phase === 'playing' && (
          <div className={styles.cooldowns}>
            <div
              className={`${styles.cooldownItem} ${styles.spellCd} ${spellCooldownRem() > 0 ? styles.onCooldown : ''}`}
              title="One spell every 8s"
            >
              <span className={styles.cooldownName}>Spell</span>
              {spellCooldownRem() > 0 && <span className={styles.cooldownSec}>{spellCooldownRem()}s</span>}
            </div>
            <div
              className={`${styles.cooldownItem} ${styles.punchCd} ${punchCooldownRem() > 0 ? styles.onCooldown : ''}`}
              title="Punch"
            >
              <span className={styles.cooldownName}>Punch</span>
              {punchCooldownRem() > 0 && <span className={styles.cooldownSec}>{punchCooldownRem()}s</span>}
            </div>
          </div>
        )}
        {state.phase === 'countdown' && state.countdown > 0 && (
          <div className={styles.countdown} role="timer" aria-live="polite">
            {state.countdown}
          </div>
        )}
        {state.phase === 'playing' && (
          <div className={styles.timer}>Time: {state.roundTimeLeft}s</div>
        )}
      </div>

      {state.phase === 'playing' && (
        <div className={`${styles.arrowLane} ${layoutMirror ? styles.arrowLaneMirror : ''}`} role="alert" aria-live="polite">
          <div className={styles.arrowReceptor} aria-hidden />
          <div className={styles.arrowTrack}>
            {incomingAttacks.map((a) => {
              const now = Date.now();
              const remaining = Math.max(0, a.landsAt - now);
              const pct = Math.min(1, remaining / TELEGRAPH_MS);
              return (
                <div
                  key={a.id}
                  className={styles.arrow}
                  data-attack={a.type}
                  style={layoutMirror ? { right: `${pct * 100}%` } : { left: `${pct * 100}%` }}
                  aria-label={a.type === 'firebreath' ? 'Firebreath incoming' : 'Punch incoming'}
                >
                  {a.type === 'firebreath' ? (
                    <span className={styles.arrowIconFire}>↑</span>
                  ) : (
                    <span className={styles.arrowIconPunch}>◆</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.stage}>
        {remoteStream ? (
          <video
            ref={opponentVideoRef}
            className={styles.stageVideo}
            playsInline
            autoPlay
            muted={false}
            aria-label="Opponent's camera"
          />
        ) : (
          <div className={styles.stagePlaceholder}>Waiting for opponent&apos;s camera…</div>
        )}
        <SpellEffects casts={recentCasts} mySide={layoutMirror ? 'right' : 'left'} />
        {isPunchBlocking && <div className={styles.statusOverlay} data-status="block">Blocking!</div>}
        {isSpellShield && !isPunchBlocking && <div className={styles.statusOverlay} data-status="shield">Shield!</div>}
        {state.phase === 'victory' && (
          <div className={`${styles.result} ${styles.victory}`}>
            <h2>Victory</h2>
            <button type="button" onClick={onExit}>Back to lobby</button>
          </div>
        )}
        {state.phase === 'defeat' && (
          <div className={`${styles.result} ${styles.defeat}`}>
            <h2>Defeat</h2>
            <button type="button" onClick={onExit}>Back to lobby</button>
          </div>
        )}
        {connectionLost && (
          <div className={`${styles.result} ${styles.defeat}`}>
            <h2>Connection lost</h2>
            <p>Opponent disconnected before the match started.</p>
            <button type="button" onClick={onExit}>Back to lobby</button>
          </div>
        )}
      </div>

      <div className={styles.webcamWrap}>
        <video ref={videoRef as React.RefObject<HTMLVideoElement>} className={styles.webcam} playsInline muted autoPlay />
        {(status === 'running' || status === 'ready') && (
          <div className={styles.gestureOverlay}>
            {gesture !== 'none' ? (
              <span className={`${styles.spellPreview} spell-${gesture}`}>
                {gesture} {Math.round(confidence * 100)}%
              </span>
            ) : (
              <span className={styles.hint}>Firebreath ↑ · Shield ✕ · Block 🥊</span>
            )}
          </div>
        )}
        <div className={styles.fps}>Hand FPS: {status === 'running' ? fps : 0}</div>
      </div>

      <button type="button" className={styles.exit} onClick={onExit} title="Exit match">
        Exit
      </button>
      </div>
    </div>
  );
}
