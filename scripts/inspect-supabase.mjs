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

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, storage: undefined, autoRefreshToken: false },
});

const main = async () => {
  const users = await supabase.auth.admin.listUsers({ perPage: 100 });
  console.log('auth.users count:', users.data?.users?.length);
  console.log('auth.users rows:', JSON.stringify(users.data?.users?.map((u) => ({ id: u.id, email: u.email, confirmed: u.confirmed, aud: u.aud })), null, 2));
  const opsUsers = await supabase.from('ops_users').select('id,email,role').limit(10);
  console.log('ops_users error:', opsUsers.error ? opsUsers.error.message : null);
  console.log('ops_users count:', opsUsers.data?.length);
  console.log('ops_users rows:', JSON.stringify(opsUsers.data, null, 2));
  const merchants = await supabase.from('merchants').select('id,name,slug,status').limit(5);
  console.log('merchants error:', merchants.error ? merchants.error.message : null);
  console.log('merchants count:', merchants.data?.length);
  console.log('merchants rows:', JSON.stringify(merchants.data, null, 2));
};

main().catch((err) => {
  console.error('FAIL', err.message || err);
  process.exit(1);
});
