import { useState, useEffect } from 'react';

/** The current time (ms), refreshed every `intervalMs`. */
const useNow = (intervalMs) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export default useNow;
