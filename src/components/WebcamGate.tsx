import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './WebcamGate.module.css';

interface WebcamGateProps {
  onReady: (stream: MediaStream) => void;
  onBack: () => void;
}

export function WebcamGate({ onReady, onBack }: WebcamGateProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestCamera = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not access camera';
      setError(msg === 'Permission denied' ? 'Please allow webcam access to play.' : msg);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (status === 'idle') requestCamera();
    // Don't stop stream on unmount — we pass it to Tutorial when user clicks Continue.
    // Stream is stopped only when user clicks Back (see handleBack).
  }, [status]);

  const handleContinue = () => {
    const s = streamRef.current;
    if (s) onReady(s);
  };

  const handleBack = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onBack();
  };

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h2 className={styles.title}>Camera access</h2>
        <p className={styles.subtitle}>
          We need your webcam to detect hand gestures. Video never leaves your device.
        </p>
        <div className={styles.previewWrap}>
          <video
            ref={videoRef}
            className={styles.video}
            playsInline
            muted
            style={{ display: status === 'ready' ? 'block' : 'none' }}
          />
          {status === 'loading' && <div className={styles.placeholder}>Starting camera…</div>}
          {status === 'error' && (
            <div className={styles.placeholderError}>
              <p>{error}</p>
              <button type="button" className={styles.retry} onClick={requestCamera}>
                Try again
              </button>
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={handleBack}>
            Back
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={handleContinue}
            disabled={status !== 'ready'}
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}
