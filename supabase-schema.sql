-- ============================================================
-- Schema para a app Parto (Supabase / Postgres)
-- Cada tabela é associada ao user autenticado (auth.uid()).
-- Cola isto em: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- Tabela "singleton" por utilizador: dados da gravidez
create table if not exists public.pregnancy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  due_date text not null,
  conception_date text,
  last_period_date text,
  updated_at timestamptz not null default now()
);

-- Tabela "singleton" por utilizador: plano de parto
create table if not exists public.birth_plan (
  user_id uuid primary key references auth.users(id) on delete cascade,
  companion text default '',
  pain_relief jsonb default '[]'::jsonb,
  environment jsonb default '[]'::jsonb,
  post_birth jsonb default '[]'::jsonb,
  notes text default '',
  updated_at timestamptz not null default now()
);

-- Tabelas coleção (1 linha = 1 item). data em jsonb para simplicidade.
create table if not exists public.symptoms       (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.appointments   (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.weight_logs    (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.kicks          (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.checklist      (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.contractions   (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.diary          (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.blood_pressure (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.baby_names     (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.hydration      (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.exams          (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.vitamins       (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.belly_photos   (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.reflections    (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.shopping_items (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());

-- Row Level Security: cada user só vê/modifica as suas próprias linhas
do $$
declare t text;
begin
  foreach t in array array[
    'pregnancy','birth_plan','symptoms','appointments','weight_logs','kicks',
    'checklist','contractions','diary','blood_pressure','baby_names',
    'hydration','exams','vitamins','belly_photos','reflections','shopping_items'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "own rows select" on public.%I;', t);
    execute format('drop policy if exists "own rows insert" on public.%I;', t);
    execute format('drop policy if exists "own rows update" on public.%I;', t);
    execute format('drop policy if exists "own rows delete" on public.%I;', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
