import { useState, useEffect } from 'react';

const STORAGE_KEY = 'npr-small-desk:viewMode';
const MODES = ['2d', '3d'];

const readStoredMode = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored) ? stored : '2d';
  } catch {
    return '2d';
  }
};

// Persists the user's 2D/3D preference across reloads.
const useViewMode = () => {
  const [mode, setMode] = useState(readStoredMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode, etc.) — the preference just won't persist.
    }
  }, [mode]);

  return [mode, setMode];
};

export default useViewMode;
