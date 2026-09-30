import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchChannelList } from '../js/channels';

const RETRY_DELAYS_MS = [3000, 10000, 30000, 60000];

/**
 * Loads the channel lineup. On failure it keeps retrying with backoff;
 * `retry()` tries again immediately and restarts the backoff (e.g. when the
 * set is power-cycled). Only the latest attempt's result is kept.
 */
const useChannels = () => {
  const [state, setState] = useState({ channels: [], isLoading: true, error: null });
  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    clearTimeout(timerRef.current);
    const request = ++requestRef.current;
    setState((s) => ({ ...s, isLoading: s.channels.length === 0, error: null }));
    try {
      const channels = await fetchChannelList();
      if (request !== requestRef.current) return;
      attemptRef.current = 0;
      setState({ channels, isLoading: false, error: null });
    } catch (error) {
      if (request !== requestRef.current) return;
      setState((s) => ({ ...s, isLoading: false, error }));
      const delay = RETRY_DELAYS_MS[Math.min(attemptRef.current, RETRY_DELAYS_MS.length - 1)];
      attemptRef.current += 1;
      timerRef.current = setTimeout(() => load(), delay);
    }
  }, []);

  const retry = useCallback(() => {
    attemptRef.current = 0;
    load();
  }, [load]);

  useEffect(() => {
    load();
    return () => {
      clearTimeout(timerRef.current);
      requestRef.current += 1; // ignore anything still in flight
    };
  }, [load]);

  return { ...state, retry };
};

export default useChannels;
