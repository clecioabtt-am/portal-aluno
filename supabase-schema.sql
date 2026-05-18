-- BANCO DE DADOS - Portal do Aluno CEEB
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists unaccent;

create table if not exists public.alunos_ceeb (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text generated always as (lower(unaccent(trim(nome)))) stored,
  cpf text not null,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cpf)
);

create table if not exists public.diarios_ceeb (
  id uuid primary key default gen_random_uuid(),
  coordenador_id uuid references auth.users(id) on delete set null,
  nome_arquivo text,
  curso text,
  turma text,
  professor text,
  disciplina text,
  horario text,
  carga_horaria text,
  periodo text,
  total_alunos integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notas_ceeb (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references public.diarios_ceeb(id) on delete cascade,
  aluno_id uuid not null references public.alunos_ceeb(id) on delete cascade,
  curso text,
  turma text,
  professor text,
  disciplina text not null,
  horario text,
  carga_horaria text,
  periodo text,
  nota_1 numeric,
  nota_2 numeric,
  nota_3 numeric,
  nota_4 numeric,
  aproveitamento numeric,
  faltas integer default 0,
  recuperacao numeric,
  media_pos_recuperacao numeric,
  situacao text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aluno_id, disciplina, turma, periodo)
);

create or replace function public.set_notas_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_notas_updated_at on public.notas_ceeb;
create trigger trg_notas_updated_at before update on public.notas_ceeb
for each row execute procedure public.set_notas_updated_at();

alter table public.alunos_ceeb enable row level security;
alter table public.diarios_ceeb enable row level security;
alter table public.notas_ceeb enable row level security;

-- Leitura pública controlada pelo próprio site: consulta exige nome + CPF no frontend.
-- Para segurança maior, coloque autenticação individual por aluno futuramente.
drop policy if exists "alunos leitura anon" on public.alunos_ceeb;
create policy "alunos leitura anon" on public.alunos_ceeb for select using (true);

drop policy if exists "notas leitura anon" on public.notas_ceeb;
create policy "notas leitura anon" on public.notas_ceeb for select using (true);

drop policy if exists "diarios leitura anon" on public.diarios_ceeb;
create policy "diarios leitura anon" on public.diarios_ceeb for select using (true);

-- Coordenador/admin autenticado pode inserir, atualizar e excluir.
drop policy if exists "admin gerencia alunos" on public.alunos_ceeb;
create policy "admin gerencia alunos" on public.alunos_ceeb for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin gerencia diarios" on public.diarios_ceeb;
create policy "admin gerencia diarios" on public.diarios_ceeb for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin gerencia notas" on public.notas_ceeb;
create policy "admin gerencia notas" on public.notas_ceeb for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- IMPORTANTE:
-- 1. Crie o usuário do coordenador em Authentication > Users no Supabase.
-- 2. Use e-mail e senha desse usuário para entrar na área administrativa.
-- 3. No arquivo config.js, coloque SUPABASE_URL e ANON_KEY.
