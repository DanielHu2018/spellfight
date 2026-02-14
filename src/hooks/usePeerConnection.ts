import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';

/** Generate a short room ID for sharing */
function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export type ConnectionStatus = 'idle' | 'creating' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface PeerConnectionState {
  status: ConnectionStatus;
  roomId: string | null;
  connection: DataConnection | null;
  remoteStream: MediaStream | null;
  /** true = created room (host), false = joined (client). Used for side-by-side layout mirroring. */
  isHost: boolean | null;
  error: string | null;
}

const PEER_CONFIG = {
  host: '0.peerjs.com',
  secure: true,
  path: '/',
};

export function usePeerConnection() {
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const [state, setState] = useState<PeerConnectionState>({
    status: 'idle',
    roomId: null,
    connection: null,
    remoteStream: null,
    isHost: null,
    error: null,
  });

  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaConnectionsRef = useRef<MediaConnection[]>([]);

  const cleanup = useCallback(() => {
    mediaConnectionsRef.current.forEach((mc) => {
      try {
        mc.close();
      } catch (_) {}
    });
    mediaConnectionsRef.current = [];
    localStreamRef.current = null;
    if (connectionRef.current) {
      try {
        connectionRef.current.close();
      } catch (_) {}
      connectionRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setState((s) => ({
      ...s,
      connection: null,
      remoteStream: null,
      isHost: null,
    }));
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const createRoom = useCallback(() => {
    cleanup();
    const roomId = generateRoomId();
    setState({ status: 'creating', roomId, connection: null, remoteStream: null, isHost: null, error: null });

    const peer = new Peer(roomId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      setState((s) => ({ ...s, status: 'waiting', error: null }));
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        setState((s) => ({ ...s, status: 'error', error: 'Room ID taken. Try again.' }));
      } else {
        setState((s) => ({ ...s, status: 'error', error: err.message || 'Connection failed' }));
      }
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connectionRef.current = conn;
        setState((s) => ({ ...s, status: 'connected', connection: conn, isHost: true }));
      });
      conn.on('close', () => {
        connectionRef.current = null;
        setState((s) => ({ ...s, status: 'disconnected', connection: null }));
      });
      conn.on('error', () => {
        connectionRef.current = null;
        setState((s) => ({ ...s, status: 'disconnected', connection: null }));
      });
    });

    return roomId;
  }, [cleanup]);

  const joinRoom = useCallback((roomId: string) => {
    const trimmed = roomId.trim().toLowerCase();
    if (!trimmed) {
      setState((s) => ({ ...s, error: 'Enter a room code' }));
      return;
    }
    cleanup();
    setState({ status: 'joining', roomId: trimmed, connection: null, remoteStream: null, isHost: null, error: null });

    const peer = new Peer(PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      setState((s) => ({ ...s, status: 'connecting' }));
      const conn = peer.connect(trimmed, { serialization: 'json' });
      if (!conn) {
        setState((s) => ({ ...s, status: 'error', error: 'Could not connect' }));
        return;
      }
      conn.on('open', () => {
        connectionRef.current = conn;
        setState((s) => ({ ...s, status: 'connected', connection: conn, isHost: false }));
      });
      conn.on('close', () => {
        connectionRef.current = null;
        setState((s) => ({ ...s, status: 'disconnected', connection: null }));
      });
      conn.on('error', () => {
        connectionRef.current = null;
        setState((s) => ({ ...s, status: 'error', error: 'Connection failed. Check the room code.' }));
      });
    });

    peer.on('error', (err) => {
      setState((s) => ({
        ...s,
        status: 'error',
        error: err.type === 'peer-unavailable' ? 'Room not found. Check the code.' : err.message || 'Connection failed',
      }));
    });
  }, [cleanup]);

  const send = useCallback((data: unknown) => {
    const conn = connectionRef.current;
    if (conn?.open) {
      try {
        conn.send(data);
      } catch (_) {}
    }
  }, []);

  const callListenerSetRef = useRef(false);

  const startVideoCall = useCallback((localStream: MediaStream) => {
    const peer = peerRef.current;
    const conn = connectionRef.current;
    if (!peer || !conn?.open) return;
    localStreamRef.current = localStream;

    const setRemote = (stream: MediaStream) => {
      setState((s) => ({ ...s, remoteStream: stream }));
    };

    if (!callListenerSetRef.current) {
      callListenerSetRef.current = true;
      peer.on('call', (call: MediaConnection) => {
        mediaConnectionsRef.current.push(call);
        const local = localStreamRef.current;
        if (local) call.answer(local);
        call.on('stream', setRemote);
      });
    }

    const outCall = peer.call(conn.peer, localStream);
    if (outCall) {
      mediaConnectionsRef.current.push(outCall);
      outCall.on('stream', setRemote);
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    callListenerSetRef.current = false;
    setState({ status: 'idle', roomId: null, connection: null, remoteStream: null, isHost: null, error: null });
  }, [cleanup]);

  return {
    ...state,
    createRoom,
    joinRoom,
    send,
    startVideoCall,
    disconnect,
  };
}
