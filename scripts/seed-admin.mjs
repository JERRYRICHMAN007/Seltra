import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'admin@seltra.co';
const ADMIN_PASSWORD = 'SeltraOps2026!';
const ADMIN_NAME = 'Admin';

function parseDotenv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!key) continue;
    let value = rest.join('=');
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadEnv() {
  const env = Object.assign({}, process.env);
  try {
    const __filename = fileURLToPath(import.meta.url);
    const envPath = path.resolve(path.dirname(__filename), '..', '.env');
    const fileContents = readFileSync(envPath, 'utf8');
    Object.assign(env, parseDotenv(fileContents));
  } catch {
    // ignore if .env is missing
  }
  return env;
}

async function findUserByEmail(admin, email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    if (!data?.users?.length) break;

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return null;
}

async function main() {
  const env = loadEnv();
  const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL. Set it in environment or in .env.');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in environment or in .env.');
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, storage: undefined, autoRefreshToken: false },
  });

  let user = await findUserByEmail(supabaseAdmin, ADMIN_EMAIL);

  if (!user) {
    console.log(`Creating admin user ${ADMIN_EMAIL}...`);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    if (!user) throw new Error('Failed to create admin user.');
  } else {
    console.log(`Admin user ${ADMIN_EMAIL} already exists; updating password.`);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  }

  console.log(`Ensuring admin role for user ${ADMIN_EMAIL} (${user.id})...`);
  const { error: upsertError } = await supabaseAdmin.from('ops_users').upsert(
    [{ id: user.id, email: ADMIN_EMAIL, name: ADMIN_NAME, role: 'admin' }],
    { onConflict: 'id' },
  );
  if (upsertError) throw upsertError;

  console.log('Admin user seeded successfully.');
  console.log(`Login with ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch((error) => {
  console.error('Failed to seed admin user:', error.message || error);
  process.exit(1);
});
