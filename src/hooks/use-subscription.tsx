import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/use-auth";

type Sub = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string;
};

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setSub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const env = getStripeEnvironment();
    const { data } = await supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end, stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub((data as Sub | null) ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    refetch();

    const onFocus = () => refetch();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refetch();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authLoading, refetch]);

  const now = Date.now();
  const periodEndMs = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const isActive = !!sub && (
    (["active", "trialing", "past_due"].includes(sub.status) && (!periodEndMs || periodEndMs > now)) ||
    (sub.status === "canceled" && periodEndMs !== null && periodEndMs > now)
  );

  return { sub, isActive, isPro: isActive, loading: loading || authLoading, refetch };
}