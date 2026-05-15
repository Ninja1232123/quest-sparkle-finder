import { useEffect, useState } from "react";
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

  const refetch = async () => {
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
  };

  useEffect(() => {
    if (authLoading) return;
    refetch();
    if (!user) return;
    const ch = supabase
      .channel(`sub:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const now = Date.now();
  const periodEndMs = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const isActive = !!sub && (
    (["active", "trialing", "past_due"].includes(sub.status) && (!periodEndMs || periodEndMs > now)) ||
    (sub.status === "canceled" && periodEndMs !== null && periodEndMs > now)
  );

  return { sub, isActive, isPro: isActive, loading: loading || authLoading, refetch };
}