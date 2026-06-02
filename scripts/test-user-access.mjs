import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envFile = resolve(process.cwd(), '.env');
const env = readFileSync(envFile, 'utf8').split(/\r?\n/).reduce((acc, line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return acc;
  const [key, ...rest] = line.split('=');
  let value = rest.join('=');
  value = value.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  acc[key] = value;
  return acc;
}, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const ADMIN_EMAIL = 'admin@seltra.co';
const ADMIN_PASSWORD = 'SeltraOps2026!';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, storage: undefined, autoRefreshToken: false },
});

const main = async () => {
  const signIn = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log('signIn error:', signIn.error?.message);
  console.log('session:', !!signIn.data.session, 'user id:', signIn.data.user?.id);

  if (signIn.error || !signIn.data.session) return;

  const token = signIn.data.session.access_token;
  const authSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, storage: undefined, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const merchants = await authSupabase.from('merchants').select('id,name,slug,status');
  console.log('merchants error:', merchants.error?.message);
  console.log('merchants count:', merchants.data?.length);
  console.log('merchants rows:', JSON.stringify(merchants.data, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
