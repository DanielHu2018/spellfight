import styles from './Landing.module.css';

interface LandingProps {
  onPlay: () => void;
}

export function Landing({ onPlay }: LandingProps) {
  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Spell Fight</h1>
        <p className={styles.subtitle}>Cast spells with your hands. Duel real players in real time.</p>
        <div className={styles.privacy}>
          <span className={styles.privacyIcon} aria-hidden>🔒</span>
          <p>
            Hand recognition runs <strong>only on your device</strong>. No video or camera data is ever sent.
          </p>
        </div>
        <button type="button" className={styles.cta} onClick={onPlay}>
          Play
        </button>
        <p className={styles.hint}>Desktop browser with webcam required.</p>
      </div>
    </main>
  );
}
