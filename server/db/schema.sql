-- Docent v3 schema: multi-user (admin/learner), per-user document assignment,
-- pgvector embeddings, session understanding analytics.
-- Applied idempotently by scripts/migrate.mjs via the Supabase connection string.

create extension if not exists vector;

-- 1:1 with auth.users (Supabase Auth owns credentials; this holds role + profile).
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  name       text,
  role       text not null default 'learner' check (role in ('admin', 'learner')),
  created_at timestamptz not null default now()
);

-- Documents uploaded by an admin (global pool; assigned to learners below).
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  text       text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Chunked + embedded document content (pgvector). 1536 dims = text-embedding-3-small.
create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  idx         int not null,
  content     text not null,
  embedding   vector(1536)
);
create index if not exists document_chunks_doc_idx on public.document_chunks(document_id);

-- Per-user assignment: which learner can learn which documents.
create table if not exists public.user_documents (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

-- One tutoring session per learner run.
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  final_score int,
  mastery     boolean default false,
  rationale   text,
  topics      jsonb not null default '[]'::jsonb
);
create index if not exists sessions_user_idx on public.sessions(user_id, started_at desc);

-- Timeline of a session: transcript turns + understanding-score samples (for charts).
create table if not exists public.session_events (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  ts         timestamptz not null default now(),
  kind       text not null check (kind in ('turn', 'score')),
  role       text,   -- turn: 'assistant' | 'user'
  content    text,   -- turn text
  score      int,    -- score sample: global understanding 0-100
  on_track   boolean -- score sample: was the learner engaging
);
create index if not exists session_events_session_idx on public.session_events(session_id, ts);

-- RLS on everything. All legitimate access goes through the Express backend using
-- the direct Postgres connection (superuser), which bypasses RLS. Enabling RLS with
-- no permissive policies means the anon/authenticated PostgREST roles cannot read or
-- write these tables directly — defense in depth.
alter table public.profiles        enable row level security;
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;
alter table public.user_documents  enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_events  enable row level security;
