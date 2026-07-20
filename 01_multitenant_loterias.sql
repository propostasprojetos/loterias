-- ==========================================
-- LotoSmart Multi-Tenant Architecture
-- Data: 2026-06-10
-- ==========================================

-- 1. FUNÇÃO DE VALIDAÇÃO MATEMÁTICA DE CPF
CREATE OR REPLACE FUNCTION public.validar_cpf_matematico(cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    soma INT;
    resto INT;
    digito1 INT;
    digito2 INT;
    i INT;
    cpf_clean TEXT;
BEGIN
    -- Remove tudo que não for número (embora a constraint já force numérico)
    cpf_clean := regexp_replace(cpf, '[^0-9]', '', 'g');

    IF length(cpf_clean) <> 11 THEN RETURN FALSE; END IF;
    IF cpf_clean ~ '^([0-9])\1{10}$' THEN RETURN FALSE; END IF;

    -- Primeiro dígito
    soma := 0;
    FOR i IN 1..9 LOOP
        soma := soma + (CAST(SUBSTRING(cpf_clean FROM i FOR 1) AS INT) * (11 - i));
    END LOOP;
    resto := (soma * 10) % 11;
    IF resto = 10 OR resto = 11 THEN resto := 0; END IF;
    digito1 := resto;
    IF digito1 <> CAST(SUBSTRING(cpf_clean FROM 10 FOR 1) AS INT) THEN RETURN FALSE; END IF;

    -- Segundo dígito
    soma := 0;
    FOR i IN 1..10 LOOP
        soma := soma + (CAST(SUBSTRING(cpf_clean FROM i FOR 1) AS INT) * (12 - i));
    END LOOP;
    resto := (soma * 10) % 11;
    IF resto = 10 OR resto = 11 THEN resto := 0; END IF;
    digito2 := resto;
    IF digito2 <> CAST(SUBSTRING(cpf_clean FROM 11 FOR 1) AS INT) THEN RETURN FALSE; END IF;

    RETURN TRUE;
END;
$$;

-- 2. TABELA SUPER ADMINS
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE id = _user_id
  );
$$;

CREATE POLICY "Super admins visualizam super_admins"
  ON public.super_admins FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 3. TABELA JOGOS
CREATE TABLE IF NOT EXISTS public.jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  ordem INT DEFAULT 0,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.jogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de jogos ativos"
  ON public.jogos FOR SELECT USING (status = 'ativo');

CREATE POLICY "Admin gerencia jogos"
  ON public.jogos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. TABELA PLANOS
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de planos ativos"
  ON public.planos FOR SELECT USING (status = 'ativo');

CREATE POLICY "Admin gerencia planos"
  ON public.planos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. TABELA RELACIONAL PLANO_JOGOS
CREATE TABLE IF NOT EXISTS public.plano_jogos (
  plano_id UUID REFERENCES public.planos(id) ON DELETE CASCADE,
  jogo_id UUID REFERENCES public.jogos(id) ON DELETE CASCADE,
  PRIMARY KEY (plano_id, jogo_id)
);

ALTER TABLE public.plano_jogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de plano_jogos"
  ON public.plano_jogos FOR SELECT USING (true);

CREATE POLICY "Admin gerencia plano_jogos"
  ON public.plano_jogos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 6. ATUALIZAÇÃO DA TABELA PROFILES E POLÍTICAS DEPENDENTES
-- Primeiro removemos as políticas que dependem da coluna role
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all bets" ON public.bets;
DROP POLICY IF EXISTS "Admins can view all prizes" ON public.prizes;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS modulos_customizados JSONB DEFAULT '{}'::jsonb;

-- Remover coluna antiga 'role' agora que não há dependências
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Adicionar CONSTRAINTS (Com validação forte)
ALTER TABLE public.profiles ADD CONSTRAINT celular_format CHECK (celular IS NULL OR celular ~ '^\d{10,11}$');
ALTER TABLE public.profiles ADD CONSTRAINT cpf_format CHECK (cpf IS NULL OR cpf ~ '^\d{11}$');
ALTER TABLE public.profiles ADD CONSTRAINT cpf_valido CHECK (cpf IS NULL OR public.validar_cpf_matematico(cpf));
ALTER TABLE public.profiles ADD CONSTRAINT cpf_unico UNIQUE (cpf);
ALTER TABLE public.profiles ADD CONSTRAINT email_unico UNIQUE (email);

-- 7. ATUALIZAR POLÍTICAS DA TABELA PROFILES
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Usuário vê o próprio perfil"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Usuário atualiza o próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Super admin acesso total a profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Recriar as políticas para as outras tabelas usando is_super_admin
CREATE POLICY "Super admin acesso total a bets"
  ON public.bets FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin acesso total a prizes"
  ON public.prizes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin acesso total a audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 8. TRIGGER DE CRIAÇÃO DE USUÁRIO (Ajustado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, ativo, must_change_password)
    VALUES (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
        new.email,
        TRUE,
        TRUE
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (O trigger on_auth_user_created já existe, então apenas substituímos a função acima)

-- 9. RPC: CREATE USER BY ADMIN
-- Permite ao Super Admin criar contas diretamente no Auth sem deslogar
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

    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Insere no Auth
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

    -- O trigger on_auth_user_created vai disparar e criar o profile básico.
    -- Agora nós fazemos o UPDATE para incluir os dados extras que o trigger não tem.
    UPDATE public.profiles 
    SET celular = p_celular, 
        cpf = p_cpf, 
        plano_id = p_plano_id,
        must_change_password = FALSE -- Conta criada por admin
    WHERE id = v_new_user_id;

    RETURN v_new_user_id;
END;
$$;

-- 10. SEED DE DADOS E MIGRAÇÃO DO ADMIN
INSERT INTO public.super_admins (id, email)
SELECT id, 'fernando_fei@hotmail.com'
FROM auth.users
WHERE email = 'fernando_fei@hotmail.com'
ON CONFLICT DO NOTHING;

-- Criar Plano Padrão
INSERT INTO public.planos (id, nome)
VALUES (gen_random_uuid(), 'Essencial')
ON CONFLICT (nome) DO NOTHING;

-- Criar Jogos Iniciais
INSERT INTO public.jogos (id, nome, slug, parametros, ordem)
VALUES
(gen_random_uuid(), 'Lotofácil', 'lotofacil', '{"range_min": 1, "range_max": 25, "pick_size": 15}', 1),
(gen_random_uuid(), 'Quina', 'quina', '{"range_min": 1, "range_max": 80, "pick_size": 5}', 2)
ON CONFLICT (slug) DO NOTHING;
