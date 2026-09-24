/**
 * Clock helpers: between polls, the minute keeps ticking *locally* so the
 * scoreboard feels live even on a 60s network cadence. Only advances while
 * status says the ball is in play; never claims a minute the API hasn't
 * reached by more than a sane amount (stoppage).
 */
import { useEffect, useRef, useState } from 'react';

export function useTickingClock(elapsed: number, isLive: boolean, halftime: boolean, extra: number) {
  const anchor = useRef({ wall: Date.now(), elapsed });
  useEffect(() => {
    anchor.current = { wall: Date.now(), elapsed };
  }, [elapsed, isLive, halftime]);

  const [, force] = useState(0);
  useEffect(() => {
    if (!isLive || halftime) return; // no ticking during HT/FT
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isLive, halftime]);

  if (!isLive || halftime) return { minute: elapsed, stoppage: extra > elapsed ? `+${extra - elapsed}` : null };
  const wallMin = Math.floor((Date.now() - anchor.current.wall) / 60000);
  const projected = anchor.current.elapsed + wallMin;
  const minute = Math.max(elapsed, projected);
  // API-reported stoppage (elapsed > minute of half) still wins
  const rawStop = extra && extra > minute ? extra - minute : null;
  return { minute, stoppage: rawStop ? `+${rawStop}` : null };
}
