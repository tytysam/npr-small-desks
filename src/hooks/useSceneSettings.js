import { useMemo, useCallback } from 'react';
import usePersistentState from './usePersistentState';
import { SCENE_DEFAULTS, normalizeScene } from '../js/sceneSettings';

/** The Scene pane's settings, persisted and always complete. */
const useSceneSettings = () => {
  const [raw, setRaw] = usePersistentState('npr-small-desk:scene', SCENE_DEFAULTS, (v) => Boolean(v) && typeof v === 'object');
  const settings = useMemo(() => normalizeScene(raw), [raw]);
  const set = useCallback((key, value) => setRaw((s) => normalizeScene({ ...normalizeScene(s), [key]: value })), [setRaw]);
  return [settings, set];
};

export default useSceneSettings;
