import { lazy, Suspense, useEffect, useState } from 'react';
import { Landing } from './components/Landing';
import { WebcamGate } from './components/WebcamGate';
import { Tutorial } from './components/Tutorial';
import { Lobby } from './components/Lobby';
import { usePeerConnection } from './hooks/usePeerConnection';

const GameArena = lazy(() =>
  import('./components/GameArena').then((m) => ({ default: m.GameArena }))
);

export type AppScreen = 'landing' | 'webcam' | 'tutorial' | 'lobby' | 'game';

function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const peer = usePeerConnection();

  const handlePlay = () => setScreen('webcam');
  const handleWebcamReady = (s: MediaStream) => {
    setStream(s);
    setScreen('tutorial');
  };
  const handleTutorialDone = () => setScreen('lobby');

  // Preload game chunk when in lobby so it's ready when opponent connects
  useEffect(() => {
    if (screen === 'lobby') {
      import('./components/GameArena');
    }
  }, [screen]);

  const handleBackToLobby = () => {
    peer.disconnect();
    setScreen('lobby');
  };
  const handleBackFromLobby = () => {
    peer.disconnect();
    setScreen('tutorial');
  };

  // When peer connects, go to game
  useEffect(() => {
    if (peer.connection && screen === 'lobby') {
      setScreen('game');
    }
  }, [peer.connection, screen]);

  return (
    <div className="app">
      {screen === 'landing' && <Landing onPlay={handlePlay} />}
      {screen === 'webcam' && (
        <WebcamGate onReady={handleWebcamReady} onBack={() => setScreen('landing')} />
      )}
      {screen === 'tutorial' && stream && (
        <Tutorial stream={stream} onDone={handleTutorialDone} onBack={() => setScreen('webcam')} />
      )}
      {screen === 'lobby' && (
        <Lobby
          onCreateRoom={peer.createRoom}
          onJoinRoom={peer.joinRoom}
          status={peer.status}
          error={peer.error}
          onBack={handleBackFromLobby}
        />
      )}
      {screen === 'game' && stream && (
        <Suspense
          fallback={
            <div className="app-loading">
              <div className="app-loading-spinner" aria-hidden />
              <p>Loading game…</p>
            </div>
          }
        >
          <GameArena
            stream={stream}
            connection={peer.connection}
            remoteStream={peer.remoteStream}
            onStartVideoCall={peer.startVideoCall}
            onExit={handleBackToLobby}
            layoutMirror={peer.isHost === false}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
