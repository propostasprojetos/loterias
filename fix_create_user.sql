-- Script para corrigir o erro ao cadastrar usuário pelo Painel Admin
-- Rode isso no SQL Editor do Supabase

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_user_by_admin(
    p_name TEXT,
    p_email TEXT,
    p_celular TEXT,
    p_cpf TEXT,
    p_plano_id UUID,
    p_password TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_new_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- Verifica se é Super Admin
    IF NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas Super Admins podem criar usuários.';
    END IF;

    -- Gera o ID e a senha criptografada (GoTrue requer bcrypt com custo >= 10, default do pgcrypto é 6 e causa Invalid Credentials)
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));

    -- Insere no Auth com TODOS os campos de token obrigatórios como string vazia
    -- (campos NULL causam erro 500 no GoTrue durante o signInWithPassword)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at, created_at, updated_at, 
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new,
        phone_change_token, reauthentication_token,
        email_change,
        is_sso_user, deleted_at
    )
    VALUES (
        v_new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, v_encrypted_pw, 
        now(), now(), now(), 
        '{"provider":"email","providers":["email"]}'::jsonb,
        json_build_object('name', p_name),
        '', '', '',
        '', '',
        '',
        false, null
    );

    -- Insere a Identidade (provider_id = UUID em texto; sub e email_verified são obrigatórios)
    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(), v_new_user_id, v_new_user_id::text, 
        json_build_object('sub', v_new_user_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false), 
        'email', now(), now(), now()
    );

    -- Atualiza dados do profile criados pelo trigger
    UPDATE public.profiles 
    SET celular = p_celular, 
        cpf = p_cpf, 
        plano_id = p_plano_id,
        must_change_password = FALSE
    WHERE id = v_new_user_id;

    RETURN v_new_user_id;
END;
$$;
