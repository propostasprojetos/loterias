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

    -- Gera o ID e a senha criptografada
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Insere no Auth (removendo colunas instáveis e adicionando app_meta_data)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, 
        email_confirmed_at, created_at, updated_at, 
        raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
        v_new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, v_encrypted_pw, 
        now(), now(), now(), 
        '{"provider":"email","providers":["email"]}'::jsonb,
        json_build_object('name', p_name)
    );

    -- Insere a Identidade (Obrigatório nas versões recentes do Supabase para conseguir fazer login)
    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(), v_new_user_id, v_new_user_id::text, 
        json_build_object('sub', v_new_user_id::text, 'email', p_email), 
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
