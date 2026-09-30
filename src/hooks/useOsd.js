import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Transient on-screen-display messages: `flash('volume')` shows that panel
 * for a couple of seconds, and a newer flash replaces an older one.
 */
const useOsd = (durationMs = 2200) => {
  const [kind, setKind] = useState(null);
  const timerRef = useRef(null);

  const flash = useCallback(
    (next) => {
      clearTimeout(timerRef.current);
      setKind(next);
      timerRef.current = setTimeout(() => setKind(null), durationMs);
    },
    [durationMs]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return [kind, flash];
};

export default useOsd;
