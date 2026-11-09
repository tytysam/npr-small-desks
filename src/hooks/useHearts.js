import { useState, useCallback, useMemo, useRef } from 'react';
import usePersistentState from './usePersistentState';
import useLatest from './useLatest';
import { fetchHeartCounts, putHeart } from '../js/hearts';

const isIdList = (v) => Array.isArray(v) && v.every((id) => typeof id === 'string');

// Counts the server just told us about win over a fetched list for a minute:
// another colo's edge cache can lag behind a heart for up to ~30 s.
const FRESH_MS = 60000;

/**
 * Hearts: which concerts this viewer loves (`mine`, kept in localStorage)
 * and how many hearts every concert has (`counts`, shared via the Worker).
 *
 * `toggle(id)` is optimistic: it flips the heart and the count at once,
 * settles on the server's count, or undoes both if the request fails. It
 * returns whether the concert is now hearted. Counts load on `refresh()`
 * (the guide calls it on opening); `status` is 'idle' | 'loading' | 'ready'
 * | 'error'.
 */
const useHearts = () => {
  const [mineList, setMineList] = usePersistentState('npr-small-desk:hearts', [], isIdList);
  const mine = useMemo(() => new Set(mineList), [mineList]);
  const mineRef = useLatest(mine);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('idle');
  const freshRef = useRef(new Map()); // id → { count, at } from our own writes
  const requestRef = useRef(new Map()); // id → latest request number

  const refresh = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const fetched = await fetchHeartCounts();
      const now = Date.now();
      freshRef.current.forEach(({ count, at }, id) => {
        if (now - at < FRESH_MS) fetched[id] = count;
        else freshRef.current.delete(id);
      });
      setCounts(fetched);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  const toggle = useCallback(
    (id) => {
      const on = !mineRef.current.has(id);
      const flip = (heart) => {
        setMineList((list) => (heart ? [...list.filter((x) => x !== id), id] : list.filter((x) => x !== id)));
        setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (heart ? 1 : -1)) }));
      };
      flip(on);

      // Quick double-taps: only the latest request for a concert decides.
      const request = (requestRef.current.get(id) ?? 0) + 1;
      requestRef.current.set(id, request);
      putHeart(id, on).then(
        (count) => {
          if (requestRef.current.get(id) !== request) return;
          freshRef.current.set(id, { count, at: Date.now() });
          setCounts((c) => ({ ...c, [id]: count }));
        },
        () => {
          if (requestRef.current.get(id) !== request) return;
          flip(!on);
        }
      );
      return on;
    },
    [mineRef, setMineList]
  );

  const isHearted = useCallback((id) => Boolean(id) && mine.has(id), [mine]);

  return { mine, counts, status, isHearted, toggle, refresh };
};

export default useHearts;
