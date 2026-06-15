import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null);
        setLoading(false);
      });
      return () => subscription.unsubscribe();
    } catch (error) {
      console.error("[auth] Supabase is not configured:", error);
      setLoading(false);
      return undefined;
    }
  }, []);

  return { user, loading, signOut: () => supabase.auth.signOut() };
}
