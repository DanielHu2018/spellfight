import styles from './MobileControls.module.css';

interface MobileControlsProps {
  onFirebreath: () => void;
  onPunch: () => void;
  onBlockStart: () => void;
  onBlockEnd: () => void;
  spellCooldownRem: number;
  punchCooldownRem: number;
  isBlocking: boolean;
}

export function MobileControls({
  onFirebreath,
  onPunch,
  onBlockStart,
  onBlockEnd,
  spellCooldownRem,
  punchCooldownRem,
  isBlocking,
}: MobileControlsProps) {
  return (
    <div className={styles.wrap} role="group" aria-label="Touch controls">
      <button
        type="button"
        className={`${styles.btn} ${styles.firebreath}`}
        onClick={onFirebreath}
        disabled={spellCooldownRem > 0}
        aria-label="Cast firebreath"
        title="Firebreath"
      >
        <span className={styles.icon}>↑</span>
        <span className={styles.label}>Fire</span>
        {spellCooldownRem > 0 && <span className={styles.cd}>{spellCooldownRem}s</span>}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.punch}`}
        onClick={onPunch}
        disabled={punchCooldownRem > 0}
        aria-label="Punch"
        title="Punch"
      >
        <span className={styles.icon}>◆</span>
        <span className={styles.label}>Punch</span>
        {punchCooldownRem > 0 && <span className={styles.cd}>{punchCooldownRem}s</span>}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.block} ${isBlocking ? styles.blockActive : ''}`}
        onPointerDown={onBlockStart}
        onPointerUp={onBlockEnd}
        onPointerLeave={onBlockEnd}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={isBlocking ? 'Release block' : 'Block'}
        title="Hold to block"
      >
        <span className={styles.icon}>🛡</span>
        <span className={styles.label}>{isBlocking ? 'Blocking' : 'Block'}</span>
      </button>
    </div>
  );
}
