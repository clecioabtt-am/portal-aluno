-- BANCO DE DADOS - Portal do Aluno CEEB
-- Execute este arquivo completo no Supabase: SQL Editor > New query > Run.
-- Correção: esta versão NÃO usa coluna gerada com unaccent, para evitar erro no Supabase.

create extension if not exists pgcrypto;

create table if not exists public.alunos_ceeb (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text,
  cpf text not null,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cpf)
);

alter table public.alunos_ceeb add column if not exists nome_normalizado text;
alter table public.alunos_ceeb add column if not exists telefone text;
alter table public.alunos_ceeb add column if not exists email text;
alter table public.alunos_ceeb add column if not exists ativo boolean not null default true;

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

-- Limpa políticas antigas antes de recriar.
drop policy if exists "alunos leitura anon" on public.alunos_ceeb;
drop policy if exists "notas leitura anon" on public.notas_ceeb;
drop policy if exists "diarios leitura anon" on public.diarios_ceeb;
drop policy if exists "admin gerencia alunos" on public.alunos_ceeb;
drop policy if exists "admin gerencia diarios" on public.diarios_ceeb;
drop policy if exists "admin gerencia notas" on public.notas_ceeb;
drop policy if exists "painel anon gerencia alunos" on public.alunos_ceeb;
drop policy if exists "painel anon gerencia diarios" on public.diarios_ceeb;
drop policy if exists "painel anon gerencia notas" on public.notas_ceeb;

-- Leitura para o portal do aluno.
create policy "alunos leitura anon" on public.alunos_ceeb for select using (true);
create policy "notas leitura anon" on public.notas_ceeb for select using (true);
create policy "diarios leitura anon" on public.diarios_ceeb for select using (true);

-- Painel administrativo do site estático usando chave anon/public.
-- ATENÇÃO: é funcional para Cloudflare Pages estático. Para segurança máxima no futuro, usar Edge Function/service role.
create policy "painel anon gerencia alunos" on public.alunos_ceeb for all using (true) with check (true);
create policy "painel anon gerencia diarios" on public.diarios_ceeb for all using (true) with check (true);
create policy "painel anon gerencia notas" on public.notas_ceeb for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.alunos_ceeb to anon, authenticated;
grant select, insert, update, delete on public.diarios_ceeb to anon, authenticated;
grant select, insert, update, delete on public.notas_ceeb to anon, authenticated;

-- Atualiza nomes normalizados de cadastros já existentes.
update public.alunos_ceeb
set nome_normalizado = lower(trim(nome))
where nome_normalizado is null;
