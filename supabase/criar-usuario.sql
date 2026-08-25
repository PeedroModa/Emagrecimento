-- ============================================================
-- Cria (ou reconfigura) o usuário de acesso por SENHA, já confirmado,
-- para não depender do e-mail de confirmação/link mágico chegar.
--
-- Rode no SQL Editor do Supabase. É idempotente: se o usuário já existir
-- (por exemplo, criado pelo Dashboard), o script apenas redefine a senha,
-- confirma o e-mail e marca a troca de senha obrigatória.
--
-- E-mail: pedro_moda@hotmail.com
-- Senha provisória: teste123   <- o app OBRIGA a trocar no primeiro login
--
-- Antes de rodar: Authentication -> Providers -> Email precisa estar
-- habilitado COM "Enable email provider" e a opção de senha ativa.
-- ============================================================

set search_path = extensions, auth, public;

do $$
declare
  v_email text := 'pedro_moda@hotmail.com';
  v_senha text := 'teste123';
  v_id    uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(v_senha, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"must_change_password":true}'::jsonb,
      '', '', '', ''
    );
    raise notice 'Usuário criado: % (id %)', v_email, v_id;
  else
    update auth.users set
      encrypted_password = crypt(v_senha, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                           || '{"must_change_password":true}'::jsonb,
      updated_at = now()
    where id = v_id;
    raise notice 'Usuário já existia — senha redefinida: % (id %)', v_email, v_id;
  end if;

  -- Identidade "email": sem ela o login por senha falha em versões novas do GoTrue.
  if not exists (select 1 from auth.identities where user_id = v_id and provider = 'email') then
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- Conferência: deve voltar 1 linha, com confirmado = true e trocar_senha = true
select
  u.id,
  u.email,
  u.email_confirmed_at is not null            as confirmado,
  u.encrypted_password is not null            as tem_senha,
  (u.raw_user_meta_data ->> 'must_change_password')::boolean as trocar_senha,
  exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email') as tem_identidade
from auth.users u
where u.email = 'pedro_moda@hotmail.com';
