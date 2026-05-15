import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";

export const FREE_DAILY_LIMIT = 5;
const KEY_PREFIX = "marg.search.quota.v1.";

function todayKey(userId: string) {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${KEY_PREFIX}${userId}.${ymd}`;
}

function readCount(userId: string): number {
  try {
    const v = localStorage.getItem(todayKey(userId));
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Daily search quota for signed-in free users. Pro users are unlimited.
 * Soft client-side counter — the inconvenience is the point, not anti-fraud.
 */
export function useSearchQuota() {
  const { user } = useAuth();
  const { isPro, loading: subLoading } = useSubscription();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    setCount(readCount(user.id));
  }, [user]);

  const remaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - count);
  const blocked = !subLoading && !isPro && !!user && count >= FREE_DAILY_LIMIT;

  const consume = useCallback(() => {
    if (!user || isPro) return true;
    const current = readCount(user.id);
    if (current >= FREE_DAILY_LIMIT) return false;
    try { localStorage.setItem(todayKey(user.id), String(current + 1)); } catch { /* ignore */ }
    setCount(current + 1);
    return true;
  }, [user, isPro]);

  return { count, remaining, blocked, isPro, consume, limit: FREE_DAILY_LIMIT };
}