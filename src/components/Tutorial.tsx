import { useEffect, useState } from 'react';
import { useHandTracker } from '../hooks/useHandTracker';
import type { GestureType } from '../types';
import styles from './Tutorial.module.css';

const STEPS: { gesture: GestureType; label: string; hint: string }[] = [
  { gesture: 'firebreath', label: 'Firebreath', hint: 'Finger gun pointed up, hand near your lips (like blowing fire)' },
  { gesture: 'shield', label: 'Shield', hint: 'Both hands open in a cross (blocks spells only)' },
  { gesture: 'block', label: 'Block', hint: 'Boxer stance: both fists up (blocks punches only)' },
  { gesture: 'punch', label: 'Punch', hint: 'One fist (attack when not casting spells)' },
];

interface TutorialProps {
  stream: MediaStream;
  onDone: () => void;
  onBack: () => void;
}

export function Tutorial({ stream, onDone, onBack }: TutorialProps) {
  const [step, setStep] = useState(0);
  const { videoRef, status, gesture, confidence, start, stop } = useHandTracker();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    start();
    return () => stop();
  }, [stream, start, stop]);

  useEffect(() => {
    const target = STEPS[step]?.gesture;
    if (target && target !== 'none' && gesture === target && confidence >= 0.55) {
      const t = setTimeout(() => {
        setStep((s) => Math.min(s + 1, STEPS.length));
      }, 600);
      return () => clearTimeout(t);
    }
  }, [gesture, confidence, step]);

  const current = STEPS[step];
  const isComplete = step >= STEPS.length;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h2 className={styles.title}>Learn gestures</h2>
        <p className={styles.subtitle}>
          Hold each gesture until it’s detected. No video is sent—everything runs on your device.
        </p>
        <div className={styles.previewWrap}>
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            className={styles.video}
            playsInline
            muted
            autoPlay
          />
          {status === 'loading' && <div className={styles.overlay}>Loading hand tracking…</div>}
          {status === 'ready' || status === 'running' ? (
            <div className={styles.gesturePreview}>
              {gesture !== 'none' ? (
                <span className={`${styles.spellBadge} spell-${gesture}`}>
                  {gesture} {Math.round(confidence * 100)}%
                </span>
              ) : (
                <span className={styles.hint}>Move hand(s) into view</span>
              )}
            </div>
          ) : null}
        </div>
        <div className={styles.progress}>
          {STEPS.map((s, i) => (
            <div
              key={s.gesture}
              className={`${styles.dot} ${i < step ? styles.done : i === step ? styles.active : ''}`}
              aria-hidden
            />
          ))}
        </div>
        {current && !isComplete && (
          <div className={styles.step}>
            <p className={styles.stepLabel}>{current.label}</p>
            <p className={styles.stepHint}>{current.hint}</p>
          </div>
        )}
        {isComplete && (
          <div className={styles.complete}>
            <p>You’ve learned all gestures. Shield blocks spells only; Block (boxer) blocks punches only.</p>
            <button type="button" className={styles.cta} onClick={onDone}>
              Find match
            </button>
          </div>
        )}
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            stream.getTracks().forEach((t) => t.stop());
            onBack();
          }}
        >
          Back
        </button>
      </div>
    </main>
  );
}
