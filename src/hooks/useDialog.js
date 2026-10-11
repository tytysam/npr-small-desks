import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behaviour shared by the owner's manual and the TV guide:
 * focus moves to `initialFocusRef` (or the first control) on open, Tab stays
 * within `containerRef`, and Esc calls `onClose`. Returning focus on close is
 * left to the caller, which knows what opened the dialog.
 */
const useDialog = (containerRef, { onClose, initialFocusRef }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    (initialFocusRef?.current ?? containerRef.current?.querySelector(FOCUSABLE))?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusable = containerRef.current.querySelectorAll(FOCUSABLE);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Focus moves in once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export default useDialog;
