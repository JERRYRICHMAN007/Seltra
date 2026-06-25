export type SupabasePublicConfig = {
  url: string;
  key: string;
};

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: SupabasePublicConfig;
  }
}

/** Read public Supabase config — prefers runtime injection from SSR (Vercel). */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  if (typeof window !== "undefined") {
    const injected = window.__SUPABASE_CONFIG__;
    if (injected?.url && injected?.key) return injected;
  }

  return {
    url: import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  };
}

/** Server-only: current env at request time (works on Vercel without rebuild). */
export function getServerSupabasePublicConfig(): SupabasePublicConfig | null {
  if (typeof process === "undefined" || !process.env) return null;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) return null;

  return { url, key };
}
