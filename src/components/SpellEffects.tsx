import { useEffect, useState } from 'react';
import type { SpellType } from '../types';
import styles from './SpellEffects.module.css';

export type ActionType = SpellType | 'punch' | 'block';

export interface Cast {
  action: ActionType;
  side: 'me' | 'opponent';
  at: number;
}

interface SpellEffectsProps {
  casts: Cast[];
  mySide: 'left' | 'right';
}

export function SpellEffects({ casts }: SpellEffectsProps) {
  const [active, setActive] = useState<Array<Cast & { id: number }>>([]);
  const idRef = useState(() => ({ next: 0 }))[0];

  useEffect(() => {
    if (casts.length === 0) return;
    const last = casts[casts.length - 1];
    if (!last) return;
    const id = idRef.next++;
    const entry: Cast & { id: number } = { action: last.action, side: last.side, at: last.at, id };
    setActive((a) => [...a, entry]);
    const t = setTimeout(() => {
      setActive((a) => a.filter((x) => x.id !== id));
    }, 2000);
    return () => clearTimeout(t);
  }, [casts.length]);

  return (
    <div className={styles.root}>
      {active.map((c) => (
        <div
          key={c.id}
          className={`${styles.effect} ${c.side === 'me' ? styles.me : styles.opponent}`}
          data-action={c.action}
        >
          {(c.action === 'firebreath' || c.action === 'punch') && (
            <div className={c.action === 'punch' ? styles.punch : styles.fireball} />
          )}
          {(c.action === 'shield' || c.action === 'block') && <div className={styles.shield} />}
        </div>
      ))}
    </div>
  );
}
