import { useCallback, useEffect, useRef, useState } from 'react';
import type { Landmark } from '../types';
import type { GestureType } from '../types';
import { classifyGesture } from '../utils/gestureClassifier';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

type HandTrackerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface HandTrackerResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: HandTrackerStatus;
  error: string | null;
  landmarks: Landmark[];
  gesture: GestureType;
  confidence: number;
  fps: number;
  start: () => Promise<void>;
  stop: () => void;
}

export function useHandTracker(): HandTrackerResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<HandTrackerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [gesture, setGesture] = useState<HandTrackerResult['gesture']>('none');
  const [confidence, setConfidence] = useState(0);
  const [fps, setFps] = useState(0);

  const handLandmarkerRef = useRef<import('@mediapipe/tasks-vision').HandLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());

  const start = useCallback(async () => {
    setError(null);
    setStatus('loading');
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { HandLandmarker, FilesetResolver } = vision;
      const wasm = await FilesetResolver.forVisionTasks(WASM_URL);
      const landmarker = await HandLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: MODEL_URL },
        numHands: 2,
        runningMode: 'VIDEO',
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      handLandmarkerRef.current = landmarker;

      const video = videoRef.current;
      if (!video || !video.srcObject) {
        setError('No video stream. Allow webcam access first.');
        setStatus('error');
        return;
      }

      await video.play();
      setStatus('ready');

      const runDetection = () => {
        const landmarker = handLandmarkerRef.current;
        const videoEl = videoRef.current;
        if (!landmarker || !videoEl || videoEl.readyState < 2) {
          rafRef.current = requestAnimationFrame(runDetection);
          return;
        }
        const currentTime = videoEl.currentTime;
        if (currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = currentTime;
          const result = landmarker.detectForVideo(videoEl, performance.now());
          if (result.landmarks && result.landmarks.length > 0) {
            const hands: Landmark[][] = result.landmarks.map((hand: Array<{ x: number; y: number; z?: number }>) =>
              hand.map((p) => ({ x: p.x, y: p.y, z: p.z }))
            );
            setLandmarks(hands[0] ?? []);
            const { gesture: g, confidence: c } = classifyGesture(hands);
            setGesture(g);
            setConfidence(c);
          } else {
            setLandmarks([]);
            setGesture('none');
            setConfidence(0);
          }
        }
        // FPS counter
        fpsFrameCountRef.current += 1;
        const now = performance.now();
        if (now - fpsLastTimeRef.current >= 1000) {
          setFps(fpsFrameCountRef.current);
          fpsFrameCountRef.current = 0;
          fpsLastTimeRef.current = now;
        }
        rafRef.current = requestAnimationFrame(runDetection);
      };

      setStatus('running');
      runDetection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load hand tracking';
      setError(msg);
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    handLandmarkerRef.current = null;
    lastVideoTimeRef.current = -1;
    setStatus('idle');
    setLandmarks([]);
    setGesture('none');
    setConfidence(0);
    setFps(0);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return {
    videoRef,
    status,
    error,
    landmarks,
    gesture,
    confidence,
    fps,
    start,
    stop,
  };
}
