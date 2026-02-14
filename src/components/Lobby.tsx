import { useState } from 'react';
import styles from './Lobby.module.css';

interface LobbyProps {
  onCreateRoom: () => string;
  onJoinRoom: (roomId: string) => void;
  status: 'idle' | 'creating' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  onBack: () => void;
}

export function Lobby({
  onCreateRoom,
  onJoinRoom,
  status,
  error,
  onBack,
}: LobbyProps) {
  const [roomIdInput, setRoomIdInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  const handleCreate = () => {
    const id = onCreateRoom();
    setCreatedRoomId(id);
    setRoomIdInput('');
  };

  const handleJoin = () => {
    onJoinRoom(roomIdInput);
  };

  const handleCopyRoomId = () => {
    if (createdRoomId) {
      const url = `${window.location.origin}${window.location.pathname}?room=${createdRoomId}`;
      navigator.clipboard.writeText(url).catch(() => navigator.clipboard.writeText(createdRoomId));
    }
  };

  const isWaiting = status === 'waiting' || status === 'creating';
  const isConnecting = status === 'joining' || status === 'connecting';

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <h2 className={styles.title}>Multiplayer duel</h2>
        <p className={styles.subtitle}>
          Create a room and share the code with a friend, or join an existing room.
        </p>

        {createdRoomId ? (
          <div className={styles.roomSection}>
            <p className={styles.roomLabel}>Room code — share this:</p>
            <div className={styles.roomIdRow}>
              <code className={styles.roomId}>{createdRoomId}</code>
              <button type="button" className={styles.copyBtn} onClick={handleCopyRoomId}>
                Copy
              </button>
            </div>
            {isWaiting && (
              <div className={styles.finding}>
                <div className={styles.spinner} aria-hidden />
                <p>Waiting for opponent…</p>
              </div>
            )}
            <button type="button" className={styles.back} onClick={onBack}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cta}
                onClick={handleCreate}
                disabled={isWaiting || isConnecting}
              >
                Create game
              </button>
              <div className={styles.divider}>or</div>
              <div className={styles.joinRow}>
                <input
                  type="text"
                  className={styles.roomInput}
                  placeholder="Enter room code"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  maxLength={8}
                  disabled={isWaiting || isConnecting}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button
                  type="button"
                  className={styles.joinBtn}
                  onClick={handleJoin}
                  disabled={isWaiting || isConnecting}
                >
                  Join
                </button>
              </div>
            </div>
            {isConnecting && (
              <div className={styles.finding}>
                <div className={styles.spinner} aria-hidden />
                <p>Connecting…</p>
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <button type="button" className={styles.back} onClick={onBack}>
              Back
            </button>
          </>
        )}
      </div>
    </main>
  );
}
