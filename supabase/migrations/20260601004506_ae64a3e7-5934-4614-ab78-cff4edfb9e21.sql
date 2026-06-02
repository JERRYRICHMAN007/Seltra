
create table public.ops_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  role text not null default 'analyst',
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  business_name text,
  store_name text,
  business_type text,
  what_you_sell text,
  based_in text,
  monthly_revenue text,
  existing_links text,
  phone text,
  email text,
  ai_familiarity text,
  allow_ai_responses boolean default true,
  status text not null default 'applied',
  merchant_id text unique,
  review_notes text,
  reviewed_by uuid references public.ops_users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  business_type text,
  status text not null default 'active',
  owner_email text,
  owner_name text,
  store_url text,
  based_in text,
  monthly_revenue_stage text,
  onboarded_at timestamptz default now(),
  last_active_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create table public.platform_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  customer_email text,
  customer_name text,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'GHS',
  status text not null default 'pending',
  paystack_ref text,
  items jsonb default '[]'::jsonb,
  seltra_fee numeric(10,2) not null default 0,
  merchant_amount numeric(10,2) not null default 0,
  disbursed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.agent_invocations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  model text,
  action_type text,
  input_tokens int default 0,
  output_tokens int default 0,
  latency_ms int default 0,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.feature_usage (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  feature text not null,
  used_at timestamptz not null default now()
);

create table public.system_health (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null,
  latency_ms int default 0,
  error_rate numeric(5,2) default 0,
  checked_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  paystack_ref text unique,
  amount numeric(12,2) not null default 0,
  currency text not null default 'GHS',
  customer_email text,
  customer_name text,
  status text,
  seltra_fee numeric(10,2) not null default 0,
  merchant_amount numeric(10,2) not null default 0,
  disbursed boolean not null default false,
  disbursed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  endpoint text,
  method text,
  status_code int,
  latency_ms int,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ops_users to authenticated;
grant select, insert, update, delete on public.merchant_applications to authenticated;
grant select, insert, update, delete on public.merchants to authenticated;
grant select, insert, update, delete on public.platform_events to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.agent_invocations to authenticated;
grant select, insert, update, delete on public.feature_usage to authenticated;
grant select, insert, update, delete on public.system_health to authenticated;
grant select, insert, update, delete on public.payment_events to authenticated;
grant select, insert, update, delete on public.api_usage to authenticated;
grant all on public.ops_users to service_role;
grant all on public.merchant_applications to service_role;
grant all on public.merchants to service_role;
grant all on public.platform_events to service_role;
grant all on public.orders to service_role;
grant all on public.agent_invocations to service_role;
grant all on public.feature_usage to service_role;
grant all on public.system_health to service_role;
grant all on public.payment_events to service_role;
grant all on public.api_usage to service_role;

alter table public.ops_users enable row level security;
alter table public.merchant_applications enable row level security;
alter table public.merchants enable row level security;
alter table public.platform_events enable row level security;
alter table public.orders enable row level security;
alter table public.agent_invocations enable row level security;
alter table public.feature_usage enable row level security;
alter table public.system_health enable row level security;
alter table public.payment_events enable row level security;
alter table public.api_usage enable row level security;

create or replace function public.is_ops_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ops_users where id = auth.uid())
$$;

grant execute on function public.is_ops_user() to authenticated;

create policy "ops_users_select" on public.ops_users for select to authenticated using (public.is_ops_user() or id = auth.uid());
create policy "ops_users_update_self" on public.ops_users for update to authenticated using (id = auth.uid());

do $$
declare t text;
begin
  for t in select unnest(array[
    'merchant_applications','merchants','platform_events','orders',
    'agent_invocations','feature_usage','system_health','payment_events','api_usage'
  ]) loop
    execute format('create policy "%s_ops_all" on public.%I for all to authenticated using (public.is_ops_user()) with check (public.is_ops_user())', t, t);
  end loop;
end$$;

create or replace function public.handle_new_ops_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email !~* '@seltra\.co$' then
    raise exception 'Only @seltra.co email addresses are permitted';
  end if;
  insert into public.ops_users (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), 'analyst')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_ops_user();

alter publication supabase_realtime add table public.platform_events;
alter publication supabase_realtime add table public.system_health;

-- SEED
insert into public.merchants (name, slug, business_type, status, owner_email, owner_name, store_url, based_in, monthly_revenue_stage, onboarded_at, last_active_at) values
('Accra Threads','accra-threads','Fashion','active','ama@accrathreads.com','Ama Owusu','https://accra-threads.seltra.shop','Accra, Ghana','10k-50k', now() - interval '120 days', now() - interval '2 hours'),
('Kente Republic','kente-republic','Fashion','active','kojo@kente.gh','Kojo Mensah','https://kente-republic.seltra.shop','Kumasi, Ghana','50k-100k', now() - interval '95 days', now() - interval '30 minutes'),
('Bola Beauty','bola-beauty','Beauty','active','bola@bolabeauty.com','Bola Adekunle','https://bola-beauty.seltra.shop','Lagos, Nigeria','5k-10k', now() - interval '80 days', now() - interval '1 day'),
('Zuri Naturals','zuri-naturals','Beauty','active','zuri@zurinaturals.com','Zuri Achebe','https://zuri-naturals.seltra.shop','Nairobi, Kenya','10k-50k', now() - interval '70 days', now() - interval '4 hours'),
('Sankofa Crafts','sankofa-crafts','Crafts','paused','dela@sankofa.gh','Dela Mensa','https://sankofa-crafts.seltra.shop','Cape Coast, Ghana','<5k', now() - interval '150 days', now() - interval '21 days'),
('Tema Tech','tema-tech','Electronics','active','femi@tematech.com','Femi Adeyemi','https://tema-tech.seltra.shop','Tema, Ghana','100k+', now() - interval '200 days', now() - interval '12 hours'),
('Mama Kitchen','mama-kitchen','Food','active','akua@mamakitchen.gh','Akua Boateng','https://mama-kitchen.seltra.shop','Accra, Ghana','10k-50k', now() - interval '60 days', now() - interval '5 hours'),
('Lagos Luxe','lagos-luxe','Fashion','active','ngozi@lagosluxe.com','Ngozi Okafor','https://lagos-luxe.seltra.shop','Lagos, Nigeria','50k-100k', now() - interval '45 days', now() - interval '1 hour'),
('Savanna Spice','savanna-spice','Food','suspended','ibrahim@savanna.gh','Ibrahim Mohammed','https://savanna-spice.seltra.shop','Tamale, Ghana','<5k', now() - interval '180 days', now() - interval '45 days'),
('Ubuntu Wears','ubuntu-wears','Fashion','active','thabo@ubuntu.co.za','Thabo Nkosi','https://ubuntu-wears.seltra.shop','Johannesburg, SA','10k-50k', now() - interval '110 days', now() - interval '3 hours'),
('Coral Reef Jewelry','coral-reef','Jewelry','active','aisha@coralreef.com','Aisha Bello','https://coral-reef.seltra.shop','Mombasa, Kenya','10k-50k', now() - interval '40 days', now() - interval '8 hours'),
('Baobab Books','baobab-books','Books','active','kwame@baobab.gh','Kwame Asante','https://baobab-books.seltra.shop','Accra, Ghana','5k-10k', now() - interval '90 days', now() - interval '6 hours'),
('Marula Skin','marula-skin','Beauty','active','lerato@marula.com','Lerato Dlamini','https://marula-skin.seltra.shop','Pretoria, SA','50k-100k', now() - interval '55 days', now() - interval '40 minutes'),
('Pikin Toys','pikin-toys','Toys','churned','chinedu@pikin.com','Chinedu Eze','https://pikin-toys.seltra.shop','Abuja, Nigeria','<5k', now() - interval '250 days', now() - interval '90 days'),
('Adinkra Decor','adinkra-decor','Home','active','esi@adinkra.gh','Esi Boateng','https://adinkra-decor.seltra.shop','Kumasi, Ghana','10k-50k', now() - interval '35 days', now() - interval '2 hours'),
('Jollof Junction','jollof-junction','Food','active','tunde@jollof.com','Tunde Bakare','https://jollof-junction.seltra.shop','Ibadan, Nigeria','5k-10k', now() - interval '25 days', now() - interval '1 day'),
('Maasai Market','maasai-market','Crafts','active','wanjiku@maasai.co.ke','Wanjiku Kamau','https://maasai-market.seltra.shop','Nairobi, Kenya','10k-50k', now() - interval '75 days', now() - interval '5 hours'),
('Volta Vines','volta-vines','Food','paused','seyram@voltavines.com','Seyram Agbeko','https://volta-vines.seltra.shop','Ho, Ghana','<5k', now() - interval '130 days', now() - interval '14 days'),
('Naija Knits','naija-knits','Fashion','active','funke@naijaknits.com','Funke Adebayo','https://naija-knits.seltra.shop','Lagos, Nigeria','5k-10k', now() - interval '20 days', now() - interval '3 hours'),
('Soko Sneakers','soko-sneakers','Fashion','active','juma@soko.co.ke','Juma Otieno','https://soko-sneakers.seltra.shop','Nairobi, Kenya','50k-100k', now() - interval '85 days', now() - interval '20 minutes'),
('Cocoa & Cream','cocoa-cream','Food','active','abena@cocoacream.gh','Abena Frimpong','https://cocoa-cream.seltra.shop','Accra, Ghana','10k-50k', now() - interval '50 days', now() - interval '6 hours'),
('Veld & Stone','veld-stone','Home','active','sipho@veldstone.co.za','Sipho Mthembu','https://veld-stone.seltra.shop','Cape Town, SA','100k+', now() - interval '170 days', now() - interval '1 hour');

insert into public.merchant_applications (full_name,business_name,store_name,business_type,what_you_sell,based_in,monthly_revenue,phone,email,ai_familiarity,status,created_at) values
('Yaa Ofori','Yaa Bags','Yaa Bags','Fashion','Handmade leather bags','Accra, Ghana','5k-10k','+233244111222','yaa@yaabags.com','intermediate','applied', now() - interval '2 days'),
('Tolu Bankole','Tolu Sneaks','Tolu Sneaks','Fashion','Custom sneakers','Lagos, Nigeria','<5k','+234803222111','tolu@tolusneaks.com','beginner','applied', now() - interval '1 day'),
('Naledi Khumalo','Naledi Naturals','Naledi Naturals','Beauty','Organic soaps','Cape Town, SA','10k-50k','+27821112233','naledi@naledi.co.za','advanced','reviewed', now() - interval '5 days'),
('Kemi Adesanya','Kemi Crafts','Kemi Crafts','Crafts','Beaded jewelry','Ibadan, Nigeria','<5k','+234701444333','kemi@kemicrafts.com','beginner','applied', now() - interval '3 hours'),
('Mawuli Dogbe','Mawuli Tech','Mawuli Tech','Electronics','Phone accessories','Tema, Ghana','5k-10k','+233503555444','mawuli@mawulitech.com','intermediate','reviewed', now() - interval '7 days'),
('Chiamaka Eze','Chia Reads','Chia Reads','Books','African literature','Enugu, Nigeria','<5k','+234812666555','chia@chiareads.com','intermediate','applied', now() - interval '12 hours'),
('Sade Williams','Sade Skin','Sade Skin','Beauty','Shea butter products','Lagos, Nigeria','5k-10k','+234809888777','sade@sadeskin.com','intermediate','approved', now() - interval '15 days'),
('Brian Otieno','Brian Bites','Brian Bites','Food','Spice blends','Kisumu, Kenya','<5k','+254712999000','brian@brianbites.com','beginner','rejected', now() - interval '20 days'),
('Nana Yaw','Yaw Threads','Yaw Threads','Fashion','Bespoke suits','Accra, Ghana','50k-100k','+233244010101','nana@yawthreads.com','advanced','applied', now() - interval '6 hours'),
('Onyeka Iwu','Onyx Decor','Onyx Decor','Home','Afrocentric decor','Abuja, Nigeria','5k-10k','+234701020304','onyeka@onyxdecor.com','intermediate','reviewed', now() - interval '4 days'),
('Wangari Mwangi','Wangari Wears','Wangari Wears','Fashion','Ankara dresses','Nairobi, Kenya','10k-50k','+254722030405','wangari@wangari.co.ke','intermediate','applied', now() - interval '8 hours'),
('Adwoa Sefa','Adwoa Wears','Adwoa Wears','Fashion','Kente fusion wear','Kumasi, Ghana','10k-50k','+233557777888','adwoa@adwoawears.com','advanced','approved', now() - interval '10 days');

update public.merchant_applications set merchant_id='SELTRA-A001', approved_at = now() - interval '10 days' where email='adwoa@adwoawears.com';
update public.merchant_applications set merchant_id='SELTRA-A002', approved_at = now() - interval '15 days' where email='sade@sadeskin.com';

insert into public.platform_events (merchant_id, event_type, created_at)
select m.id,
  (array['login','store_created','product_added','order_placed','payment_received','agent_invoked','theme_updated','settings_changed'])[1 + floor(random()*8)::int],
  now() - (random() * interval '30 days')
from public.merchants m, generate_series(1, 28) g;

insert into public.orders (merchant_id, customer_email, customer_name, total_amount, currency, status, paystack_ref, items, seltra_fee, merchant_amount, disbursed, created_at)
select m.id, 'customer'||g||'@example.com',
  (array['Akua M.','Kojo A.','Ngozi P.','Sade O.','Thabo D.','Aisha B.','Tunde K.','Wanjiku N.'])[1 + floor(random()*8)::int],
  (50 + random()*950)::numeric(12,2), 'GHS',
  (array['paid','paid','paid','paid','pending','failed','cancelled'])[1 + floor(random()*7)::int],
  'PSTK_'||substr(md5(random()::text),1,12),
  '[{"name":"Item","qty":1,"price":150}]'::jsonb,
  ((50 + random()*950) * 0.025)::numeric(10,2),
  ((50 + random()*950) * 0.975)::numeric(10,2),
  random() > 0.4,
  now() - (random() * interval '30 days')
from public.merchants m, generate_series(1,13) g
where m.status != 'churned';

insert into public.agent_invocations (merchant_id, model, action_type, input_tokens, output_tokens, latency_ms, success, error_message, created_at)
select m.id,
  (array['claude-sonnet','claude-sonnet','gpt-4o','gpt-4o-mini','gemini-2.5-flash'])[1 + floor(random()*5)::int],
  (array['ADD_PRODUCT','UPDATE_THEME','chat','SET_POLICY','GENERATE_DESCRIPTION','BULK_IMPORT'])[1 + floor(random()*6)::int],
  (200 + random()*2000)::int, (100 + random()*1500)::int, (400 + random()*4000)::int,
  random() > 0.08,
  case when random() < 0.08 then (array['rate_limit','timeout','invalid_input','provider_error'])[1+floor(random()*4)::int] else null end,
  now() - (random() * interval '30 days')
from public.merchants m, generate_series(1,28) g
where m.status = 'active';

insert into public.feature_usage (merchant_id, feature, used_at)
select m.id,
  (array['agent_chat','product_upload','storefront_preview','payment_link','settings','orders','analytics','theme_editor'])[1 + floor(random()*8)::int],
  now() - (random() * interval '30 days')
from public.merchants m, generate_series(1,40) g
where m.status != 'churned';

insert into public.system_health (service, status, latency_ms, error_rate, checked_at)
select s.service,
  case when random() < 0.92 then 'healthy' when random() < 0.98 then 'degraded' else 'down' end,
  (case s.service when 'api' then 80 when 'agent' then 1200 when 'storefront' then 150 when 'payments' then 400 else 30 end + random()*200)::int,
  (random()*2)::numeric(5,2),
  now() - (g || ' hours')::interval
from (values ('api'),('agent'),('storefront'),('payments'),('db')) as s(service),
generate_series(0, 720, 2) g;

insert into public.payment_events (merchant_id, paystack_ref, amount, currency, customer_email, customer_name, status, seltra_fee, merchant_amount, disbursed, disbursed_at, created_at)
select o.merchant_id, o.paystack_ref, o.total_amount, o.currency, o.customer_email, o.customer_name,
  case o.status when 'paid' then 'success' when 'failed' then 'failed' else 'pending' end,
  o.seltra_fee, o.merchant_amount, o.disbursed,
  case when o.disbursed then o.created_at + interval '1 day' else null end,
  o.created_at
from public.orders o
where o.status in ('paid','failed');

insert into public.api_usage (merchant_id, endpoint, method, status_code, latency_ms, created_at)
select m.id,
  (array['/v1/products','/v1/orders','/v1/customers','/v1/payments','/v1/storefront','/v1/agent/invoke','/v1/webhooks'])[1+floor(random()*7)::int],
  (array['GET','GET','GET','POST','POST','PATCH','DELETE'])[1+floor(random()*7)::int],
  case when random() < 0.93 then 200 when random() < 0.98 then 400 else 500 end,
  (20 + random()*500)::int,
  now() - (random() * interval '7 days')
from public.merchants m, generate_series(1,25) g
where m.status = 'active';
