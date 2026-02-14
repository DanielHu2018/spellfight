# Handzo — Gesture-Based PvP Duel

A two-player, web-based duel where you cast spells using **real-time hand gestures** from your webcam. Gesture detection runs **locally** (MediaPipe Hands); only game events are sent over the network (Phase 2: P2P).

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`) in a **desktop browser** and allow webcam access.

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **@mediapipe/tasks-vision** — Hand Landmarker for 21 hand landmarks
- **Rule-based gesture classifier** — Fist → Fireball, Palm → Shield, Two-finger point → Lightning, Palm up → Heal
- **PeerJS** (dependency in place for Phase 2 P2P matchmaking)

## Current scope (Phase 1)

- Landing page with privacy note (no video sent)
- Webcam permission flow
- Short tutorial: detect 3 gestures (fireball, shield, lightning)
- Lobby with “Play now” (instant start for demo)
- Game arena: health bars, per-spell cooldowns, spell effects (fireball, shield, lightning, heal)
- Local game loop: your spells reduce “opponent” health; victory/defeat and round timer

## Next (Phase 2)

- WebRTC P2P via PeerJS (or similar) for real 1v1 matches
- Signaling for matchmaking and connection setup
- Sync spell casts and health over the data channel with minimal events

## Deploy

Build and deploy the `dist` folder (e.g. to **Vercel**):

```bash
npm run build
```

Then deploy `dist` or connect the repo to Vercel for automatic builds.
