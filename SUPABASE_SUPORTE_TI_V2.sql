-- SUPORTE DE TI - Versão 2
-- Execute tudo no Supabase > SQL Editor.
-- Esta versão faz o painel do Suporte criar usuários diretamente no Supabase Authentication
-- e listar os coordenadores que já existem no Authentication.

create extension if not exists pgcrypto;

create table if not exists public.coordenadores_logins_ceeb (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_temporaria text,
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

-- Função para criar coordenador no Supabase Auth.
-- Importante: o suporte logado deve ser suporte.ti@ceeb.com.
create or replace function public.criar_coordenador_auth_ceeb(
  p_nome text,
  p_email text,
  p_senha text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_support_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_support_email <> 'suporte.ti@ceeb.com' then
    raise exception 'Acesso permitido somente ao Suporte de TI.';
  end if;

  if coalesce(trim(p_nome), '') = '' or v_email = '' or length(coalesce(p_senha, '')) < 6 then
    raise exception 'Informe nome, e-mail e senha com pelo menos 6 caracteres.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(p_senha, gen_salt('bf')),
      now(),
      null,
      '',
      null,
      '',
      null,
      '',
      '',
      null,
      null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', p_nome, 'perfil', 'coordenador'),
      false,
      now(),
      now(),
      null,
      null,
      '',
      '',
      null,
      '',
      0,
      null,
      '',
      null,
      false,
      null,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid()::text,
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      null,
      now(),
      now()
    ) on conflict do nothing;
  else
    update auth.users
    set
      encrypted_password = crypt(p_senha, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      email_change = coalesce(email_change, ''),
      phone_change = coalesce(phone_change, ''),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nome', p_nome, 'perfil', 'coordenador'),
      updated_at = now()
    where id = v_user_id;

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid()::text,
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      null,
      now(),
      now()
    ) on conflict do nothing;
  end if;

  insert into public.coordenadores_logins_ceeb (nome, email, senha_temporaria, criado_por)
  values (p_nome, v_email, p_senha, v_support_email)
  on conflict (email) do update set
    nome = excluded.nome,
    senha_temporaria = excluded.senha_temporaria,
    criado_por = excluded.criado_por,
    created_at = now();

  return jsonb_build_object('ok', true, 'message', 'Coordenador criado/atualizado no Supabase Authentication.');
end;
$$;

grant execute on function public.criar_coordenador_auth_ceeb(text, text, text) to authenticated;

-- Função para o painel do suporte listar usuários existentes no Supabase Auth.
create or replace function public.listar_coordenadores_auth_ceeb()
returns table (
  id uuid,
  created_at timestamptz,
  nome text,
  email text,
  senha_temporaria text,
  criado_por text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_support_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_support_email <> 'suporte.ti@ceeb.com' then
    raise exception 'Acesso permitido somente ao Suporte de TI.';
  end if;

  return query
  select
    u.id,
    u.created_at,
    coalesce(l.nome, u.raw_user_meta_data ->> 'nome', '-')::text as nome,
    u.email::text,
    l.senha_temporaria::text,
    coalesce(l.criado_por, 'Supabase Auth')::text as criado_por
  from auth.users u
  left join public.coordenadores_logins_ceeb l on lower(l.email) = lower(u.email)
  where lower(u.email) <> 'suporte.ti@ceeb.com'
    and u.deleted_at is null
  order by u.created_at desc;
end;
$$;

grant execute on function public.listar_coordenadores_auth_ceeb() to authenticated;

-- Corrige tokens NULL dos usuários existentes, evitando erro 500 no Auth.
update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now();
