import { useEffect, useRef } from 'react';
import { socket } from '../api/client';

/**
 * useSocket — manages the shared Socket.IO connection.
 * @param {string} event   - event name to listen for
 * @param {Function} handler - callback on event
 */
export function useSocket(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    socket.connect();
    const cb = (...args) => handlerRef.current(...args);
    socket.on(event, cb);
    return () => {
      socket.off(event, cb);
    };
  }, [event]);
}
