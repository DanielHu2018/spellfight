import type { Landmark } from '../types';
import type { GestureType } from '../types';

const CONFIDENCE_THRESHOLD = 0.55;
const AMBIGUITY_THRESHOLD = 0.08;

// MediaPipe hand landmark indices (y increases downward: smaller y = higher on screen)
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_PIP = 6, INDEX_TIP = 8;
const MIDDLE_PIP = 10, MIDDLE_TIP = 12;
const RING_PIP = 14, RING_TIP = 16;
const PINKY_PIP = 18, PINKY_TIP = 20;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Finger gun: index extended, middle/ring/pinky closed. Relaxed: index tip is clearly out from pip. */
function isFingerGun(landmarks: Landmark[]): number {
  if (landmarks.length < 21) return 0;
  const a = landmarks[INDEX_TIP], b = landmarks[INDEX_PIP];
  const c = landmarks[MIDDLE_TIP], d = landmarks[MIDDLE_PIP];
  const e = landmarks[RING_TIP], f = landmarks[RING_PIP];
  const g = landmarks[PINKY_TIP], h = landmarks[PINKY_PIP];
  const wrist = landmarks[WRIST];
  if (!a || !b || !c || !d || !e || !f || !g || !h || !wrist) return 0;
  const indexExtended = a.y < b.y + 0.03 || dist(a, wrist) > dist(b, wrist) * 1.15;
  const middleClosed = c.y > d.y - 0.02;
  const ringClosed = e.y > f.y - 0.02;
  const pinkyClosed = g.y > h.y - 0.02;
  if (!indexExtended || !middleClosed || !ringClosed || !pinkyClosed) return 0;
  return 0.85;
}

/** Firebreath: finger gun pointed UP (index tip above wrist) */
function isFingerGunUp(landmarks: Landmark[]): number {
  const base = isFingerGun(landmarks);
  if (base === 0) return 0;
  const wrist = landmarks[WRIST];
  const indexTip = landmarks[INDEX_TIP];
  if (!wrist || !indexTip) return 0;
  if (indexTip.y >= wrist.y - 0.02) return 0;
  return 0.88;
}

function isFist(landmarks: Landmark[]): number {
  if (landmarks.length < 21) return 0;
  const a = landmarks[INDEX_TIP], b = landmarks[INDEX_PIP], c = landmarks[MIDDLE_TIP], d = landmarks[MIDDLE_PIP];
  const e = landmarks[RING_TIP], f = landmarks[RING_PIP], g = landmarks[PINKY_TIP], h = landmarks[PINKY_PIP];
  if (!a || !b || !c || !d || !e || !f || !g || !h) return 0;
  const indexClosed = a.y > b.y - 0.02;
  const middleClosed = c.y > d.y - 0.02;
  const ringClosed = e.y > f.y - 0.02;
  const pinkyClosed = g.y > h.y - 0.02;
  const closed = [indexClosed, middleClosed, ringClosed, pinkyClosed].filter(Boolean).length;
  if (closed >= 4) return 0.9;
  if (closed >= 3) return 0.72;
  return 0;
}

function isPalm(landmarks: Landmark[]): number {
  if (landmarks.length < 21) return 0;
  const a = landmarks[INDEX_TIP], b = landmarks[INDEX_PIP], c = landmarks[MIDDLE_TIP], d = landmarks[MIDDLE_PIP];
  const e = landmarks[RING_TIP], f = landmarks[RING_PIP], g = landmarks[PINKY_TIP], h = landmarks[PINKY_PIP];
  const th = landmarks[THUMB_TIP];
  if (!a || !b || !c || !d || !e || !f || !g || !h || !th) return 0;
  const indexExtended = a.y < b.y + 0.02;
  const middleExtended = c.y < d.y + 0.02;
  const ringExtended = e.y < f.y + 0.02;
  const pinkyExtended = g.y < h.y + 0.02;
  const extended = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
  const spread = dist(a, g) > 0.1;
  if (extended >= 4 && spread) return 0.88;
  if (extended >= 3) return 0.6;
  return 0;
}

/**
 * Classify gesture from one or two hands.
 */
export function classifyGesture(hands: Landmark[][]): { gesture: GestureType; confidence: number } {
  const scores: Record<GestureType, number> = {
    none: 0,
    firebreath: 0,
    shield: 0,
    punch: 0,
    block: 0,
  };

  if (hands.length === 0) return { gesture: 'none', confidence: 0 };

  if (hands.length >= 2) {
    const [h0, h1] = hands;
    if (h0 && h1) {
      const palm0 = isPalm(h0), palm1 = isPalm(h1);
      const fist0 = isFist(h0), fist1 = isFist(h1);
      if (palm0 > 0.45 && palm1 > 0.45) scores.shield = (palm0 + palm1) / 2;
      // Require clearly closed fists for block so open palms / loose hands don't register as block
      if (fist0 > 0.7 && fist1 > 0.7) scores.block = (fist0 + fist1) / 2;
    }
  }

  const primary = hands[0];
  if (primary) {
    if (hands.length === 1) {
      if (isFingerGunUp(primary) > 0) scores.firebreath = isFingerGunUp(primary);
      scores.punch = isFist(primary);
    } else {
      const twoHandMax = Math.max(scores.shield, scores.block);
      if (twoHandMax < 0.5) {
        if (isFingerGunUp(primary) > 0) scores.firebreath = isFingerGunUp(primary);
        scores.punch = isFist(primary);
      }
    }
  }

  const entries = (Object.entries(scores) as [GestureType, number][])
    .filter(([g]) => g !== 'none' && scores[g] > 0)
    .sort((a, b) => b[1] - a[1]);

  let top = entries[0];
  const second = entries[1];
  if (!top || top[1] < CONFIDENCE_THRESHOLD)
    return { gesture: 'none', confidence: top?.[1] ?? 0 };
  // When shield and block are both plausible, prefer shield so open palms aren't misread as block
  if (top[0] === 'block' && scores.shield >= 0.5 && scores.shield >= top[1] - 0.12) {
    top = ['shield', scores.shield] as [GestureType, number];
  }
  if (second && top[1] - second[1] < AMBIGUITY_THRESHOLD)
    return { gesture: 'none', confidence: top[1] };
  return { gesture: top[0], confidence: top[1] };
}

export { CONFIDENCE_THRESHOLD };
