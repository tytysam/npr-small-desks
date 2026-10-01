import { useMemo, useCallback } from 'react';
import usePersistentState from './usePersistentState';
import { CRT_DEFAULTS, normalizeCrt, adjustCrt } from '../js/crtSettings';

/** The SETUP menu's picture settings, persisted and always complete. */
const useCrtSettings = () => {
  const [raw, setRaw] = usePersistentState('npr-small-desk:crt', CRT_DEFAULTS, (v) => Boolean(v) && typeof v === 'object');
  const settings = useMemo(() => normalizeCrt(raw), [raw]);
  const adjust = useCallback((key, direction) => setRaw((s) => adjustCrt(normalizeCrt(s), key, direction)), [setRaw]);
  return [settings, adjust];
};

export default useCrtSettings;
