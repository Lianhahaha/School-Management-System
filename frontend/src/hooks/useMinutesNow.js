import { useEffect, useState } from 'react';

const MINUTE = 60_000;

/** Minutes since midnight, refreshed every minute so "now" highlights and links follow the clock. */
export function useMinutesNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}
