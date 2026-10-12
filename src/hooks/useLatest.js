import { useLayoutEffect, useRef } from 'react';

/**
 * A ref that always holds the latest `value`, for event handlers and timers
 * that need to stay stable but read current props. It's updated after render
 * rather than during it; handlers only run once the commit is done, so they
 * never see it stale.
 */
const useLatest = (value) => {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};

export default useLatest;
