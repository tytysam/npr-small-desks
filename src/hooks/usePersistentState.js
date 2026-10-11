import { useState, useEffect } from 'react';

const read = (key, fallback, isValid) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw; // written before values were JSON-encoded
    }
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

/**
 * useState that survives reloads via localStorage. Values that fail
 * `isValid` (stale or hand-edited) fall back to `initial`. Storage being
 * unavailable (private mode, etc.) just means nothing persists.
 */
const usePersistentState = (key, initial, isValid = () => true) => {
  const [value, setValue] = useState(() => read(key, initial, isValid));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable — the value just won't persist.
    }
  }, [key, value]);

  return [value, setValue];
};

export default usePersistentState;
