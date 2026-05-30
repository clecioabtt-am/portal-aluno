-- MIGRAÇÃO - Suporte de TI do Portal do Aluno CEEB
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Login criado para o Suporte de TI:
-- E-mail: suporte.ti@ceeb.com
-- Senha: SuporteTI@2026

create extension if not exists pgcrypto;

-- 1) Registra credenciais criadas pelo painel do Suporte.
create table if not exists public.coordenadores_logins_ceeb (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_temporaria text not null,
  criado_por text,
  created_at timestamptz not null default now()
);

alter table public.coordenadores_logins_ceeb enable row level security;

drop policy if exists "suporte ti gerencia logins administrativos" on public.coordenadores_logins_ceeb;
create policy "suporte ti gerencia logins administrativos" on public.coordenadores_logins_ceeb
for all to authenticated
using (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com')
with check (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com');

grant select, insert, update, delete on public.coordenadores_logins_ceeb to authenticated;

-- 2) Libera o Suporte de TI para visualizar, editar e excluir dados de todos os coordenadores.
alter table public.alunos_ceeb enable row level security;
alter table public.diarios_ceeb enable row level security;
alter table public.notas_ceeb enable row level security;

drop policy if exists "suporte ti gerencia todos alunos" on public.alunos_ceeb;
drop policy if exists "suporte ti gerencia todos diarios" on public.diarios_ceeb;
drop policy if exists "suporte ti gerencia todas notas" on public.notas_ceeb;

create policy "suporte ti gerencia todos alunos" on public.alunos_ceeb
for all to authenticated
using (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com')
with check (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com');

create policy "suporte ti gerencia todos diarios" on public.diarios_ceeb
for all to authenticated
using (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com')
with check (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com');

create policy "suporte ti gerencia todas notas" on public.notas_ceeb
for all to authenticated
using (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com')
with check (lower(auth.jwt() ->> 'email') = 'suporte.ti@ceeb.com');

-- 3) Tenta criar automaticamente o usuário do Suporte de TI no Supabase Auth.
-- Caso seu projeto bloqueie criação direta via SQL, crie manualmente em Authentication > Add user
-- usando o mesmo e-mail e senha informados acima.
do $$
declare
  suporte_id uuid;
begin
  select id into suporte_id from auth.users where lower(email) = 'suporte.ti@ceeb.com' limit 1;

  if suporte_id is null then
    suporte_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000',
      suporte_id,
      'authenticated',
      'authenticated',
      'suporte.ti@ceeb.com',
      crypt('SuporteTI@2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Suporte de TI","perfil":"suporte_ti"}'::jsonb,
      false
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      suporte_id,
      suporte_id,
      'suporte.ti@ceeb.com',
      jsonb_build_object('sub', suporte_id::text, 'email', 'suporte.ti@ceeb.com'),
      'email',
      now(), now(), now()
    ) on conflict do nothing;
  else
    update auth.users
    set encrypted_password = crypt('SuporteTI@2026', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now(),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"nome":"Suporte de TI","perfil":"suporte_ti"}'::jsonb
    where id = suporte_id;
  end if;
end $$;
