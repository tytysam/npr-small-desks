import { useMemo, useEffect } from 'react';

// Frees a three.js resource, or every resource in a (shallowly nested) bundle
// of them such as { map, bumpMap } or { body: { geometry, position } }.
const dispose = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 2) return;
  if (typeof value.dispose === 'function') {
    value.dispose();
    return;
  }
  Object.values(value).forEach((v) => dispose(v, depth + 1));
};

/**
 * useMemo for textures, materials and geometries built by hand. R3F only
 * disposes objects it created from JSX, so anything passed in as a prop
 * (`map={texture}`, `geometry={geo}`, `material={mat}`) is freed here when
 * it's replaced (deps change) or the component unmounts.
 *
 * Disposing only releases the GPU copy; three re-uploads on next use, so
 * StrictMode's mount/unmount/mount in development is harmless.
 */
const useDisposable = (factory, deps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's, as with useMemo
  const value = useMemo(factory, deps);
  useEffect(() => () => dispose(value), [value]);
  return value;
};

export default useDisposable;
