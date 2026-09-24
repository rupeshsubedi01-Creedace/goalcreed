/**
 * Goal-watching: compares consecutive live snapshots and reports matches
 * whose score just moved, so the Live screen can fire the signature
 * haptic + green flash the moment a goal drops.
 */
import { useEffect, useRef, useState } from 'react';
import type { UiMatch } from '@/api/normalize';
import * as haptics from '@/lib/haptics';

export function useGoalWatch(matches: UiMatch[], enabled: boolean) {
  const prev = useRef<Map<number, string> | null>(null);
  const [flashing, setFlashing] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const cur = new Map<number, string>();
    for (const m of matches) cur.set(m.id, `${m.goalsHome}-${m.goalsAway}`);

    const before = prev.current;
    prev.current = cur;
    if (!before) return; // first snapshot — never alert on cold load

    const fresh: number[] = [];
    for (const [id, score] of cur) {
      const old = before.get(id);
      if (old !== undefined && old !== score) fresh.push(id);
    }
    if (!fresh.length) return;

    haptics.goal();
    setFlashing((s) => new Set([...s, ...fresh]));
    const t = setTimeout(() => {
      setFlashing((s) => {
        const n = new Set(s);
        for (const id of fresh) n.delete(id);
        return n;
      });
    }, 3200);
    return () => clearTimeout(t);
  }, [matches, enabled]);

  return flashing;
}
