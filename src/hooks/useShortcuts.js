import { useEffect, useRef } from 'react';

const SLIDER_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];

// Whether the focused element uses this key itself: text fields take
// everything, knobs (sliders) take arrows, buttons and switches take
// Space/Enter. Anything else is free for a shortcut.
const focusedControlOwns = (target, key) => {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true;
  if (target.closest('[role="slider"]')) return SLIDER_KEYS.includes(key);
  if (target.closest('button, [role="switch"]')) return key === ' ' || key === 'Enter';
  return false;
};

/**
 * Global keyboard shortcuts. `bindings` maps KeyboardEvent.key (letters
 * lower-cased) to a handler. Skipped when the focused control uses the key
 * itself, or a modifier is held so browser shortcuts still work.
 */
const useShortcuts = (bindings) => {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (focusedControlOwns(e.target, e.key)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handler = bindingsRef.current[key];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};

export default useShortcuts;
