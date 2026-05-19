-- MIGRAÇÃO PROFISSIONAL - Portal do Aluno CEEB
-- Objetivo: separar os dados por coordenador de polo usando Supabase Auth.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.

create extension if not exists pgcrypto;

-- 1) Garante as tabelas principais.
create table if not exists public.alunos_ceeb (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text,
  cpf text not null,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
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
  updated_at timestamptz not null default now()
);

-- 2) Colunas necessárias para isolar coordenadores.
alter table public.alunos_ceeb add column if not exists coordenador_id uuid references auth.users(id) on delete set null;
alter table public.alunos_ceeb add column if not exists nome_normalizado text;
alter table public.alunos_ceeb add column if not exists telefone text;
alter table public.alunos_ceeb add column if not exists email text;
alter table public.alunos_ceeb add column if not exists ativo boolean not null default true;
alter table public.diarios_ceeb add column if not exists coordenador_id uuid references auth.users(id) on delete set null;
alter table public.notas_ceeb add column if not exists coordenador_id uuid references auth.users(id) on delete set null;

-- 3) Propaga coordenador_id para notas antigas com base no diário.
update public.notas_ceeb n
set coordenador_id = d.coordenador_id
from public.diarios_ceeb d
where n.diario_id = d.id
  and n.coordenador_id is null
  and d.coordenador_id is not null;

-- 4) Preenche coordenador_id em alunos antigos quando for possível deduzir pela nota.
update public.alunos_ceeb a
set coordenador_id = n.coordenador_id
from public.notas_ceeb n
where a.id = n.aluno_id
  and a.coordenador_id is null
  and n.coordenador_id is not null;

-- 5) Remove restrições antigas que impediam o mesmo CPF em coordenadores diferentes.
alter table public.alunos_ceeb drop constraint if exists alunos_ceeb_cpf_key;
alter table public.notas_ceeb drop constraint if exists notas_ceeb_aluno_id_disciplina_turma_periodo_key;
alter table public.notas_ceeb drop constraint if exists notas_ceeb_aluno_id_disciplina_turma_periodo_coordenador_id_key;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.alunos_ceeb'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%cpf%'
  loop
    execute format('alter table public.alunos_ceeb drop constraint if exists %I', r.conname);
  end loop;
end $$;

-- 6) Novas restrições por coordenador.
alter table public.alunos_ceeb
  add constraint alunos_ceeb_coordenador_cpf_key unique (coordenador_id, cpf);

alter table public.notas_ceeb
  add constraint notas_ceeb_aluno_disc_turma_periodo_coord_key unique (aluno_id, disciplina, turma, periodo, coordenador_id);

-- 7) Trigger de atualização.
create or replace function public.set_notas_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_notas_updated_at on public.notas_ceeb;
create trigger trg_notas_updated_at before update on public.notas_ceeb
for each row execute procedure public.set_notas_updated_at();

-- 8) Segurança RLS.
alter table public.alunos_ceeb enable row level security;
alter table public.diarios_ceeb enable row level security;
alter table public.notas_ceeb enable row level security;

-- Remove políticas antigas/inseguras.
drop policy if exists "alunos leitura anon" on public.alunos_ceeb;
drop policy if exists "notas leitura anon" on public.notas_ceeb;
drop policy if exists "diarios leitura anon" on public.diarios_ceeb;
drop policy if exists "admin gerencia alunos" on public.alunos_ceeb;
drop policy if exists "admin gerencia diarios" on public.diarios_ceeb;
drop policy if exists "admin gerencia notas" on public.notas_ceeb;
drop policy if exists "painel anon gerencia alunos" on public.alunos_ceeb;
drop policy if exists "painel anon gerencia diarios" on public.diarios_ceeb;
drop policy if exists "painel anon gerencia notas" on public.notas_ceeb;
drop policy if exists "alunos portal consulta anon" on public.alunos_ceeb;
drop policy if exists "notas portal consulta anon" on public.notas_ceeb;
drop policy if exists "diarios portal consulta anon" on public.diarios_ceeb;
drop policy if exists "coordenador gerencia seus alunos" on public.alunos_ceeb;
drop policy if exists "coordenador gerencia seus diarios" on public.diarios_ceeb;
drop policy if exists "coordenador gerencia suas notas" on public.notas_ceeb;

-- Consulta pública do aluno: mantém o Portal do Aluno funcionando com nome + CPF.
create policy "alunos portal consulta anon" on public.alunos_ceeb
for select to anon using (true);

create policy "notas portal consulta anon" on public.notas_ceeb
for select to anon using (true);

create policy "diarios portal consulta anon" on public.diarios_ceeb
for select to anon using (true);

-- Administração: cada coordenador só gerencia seus próprios registros.
create policy "coordenador gerencia seus alunos" on public.alunos_ceeb
for all to authenticated
using (coordenador_id = auth.uid())
with check (coordenador_id = auth.uid());

create policy "coordenador gerencia seus diarios" on public.diarios_ceeb
for all to authenticated
using (coordenador_id = auth.uid())
with check (coordenador_id = auth.uid());

create policy "coordenador gerencia suas notas" on public.notas_ceeb
for all to authenticated
using (coordenador_id = auth.uid())
with check (coordenador_id = auth.uid());

-- Permissões.
grant usage on schema public to anon, authenticated;
grant select on public.alunos_ceeb to anon;
grant select on public.diarios_ceeb to anon;
grant select on public.notas_ceeb to anon;
grant select, insert, update, delete on public.alunos_ceeb to authenticated;
grant select, insert, update, delete on public.diarios_ceeb to authenticated;
grant select, insert, update, delete on public.notas_ceeb to authenticated;

-- Atualiza normalização de nomes existentes.
update public.alunos_ceeb
set nome_normalizado = lower(trim(nome))
where nome_normalizado is null;
