-- Sistema de Códigos Promocionales y Canjeo

-- 1. Tabla de Códigos Promocionales (Administrador los crea)
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    reward_type VARCHAR(20) NOT NULL, -- 'vip_days' o 'credits'
    reward_value INTEGER NOT NULL, -- Cantidad de días o créditos
    stock INTEGER DEFAULT NULL, -- NULL significa uso infinito
    used_count INTEGER DEFAULT 0, -- Rastrear cuántas veces se ha usado
    expires_at TIMESTAMP WITH TIME ZONE, -- Fecha límite de caducidad
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Redenciones (Los usuarios que han usado un código)
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Restricción UNIQUE para evitar que un mismo usuario (email) use el mismo código 2 veces
    UNIQUE(code_id, user_email)
);

-- Configuración Básica de Políticas (Row Level Security no es estricta aquí si el backend hace el trabajo pesado con Service Role o de lado del servidor)
-- Pero por convención se desactiva RLS para consumo puro de backend si no vamos a hacer consultas de frontend directo.
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Como las rutas de API (/api/...) de Next.js harán todo el trabajo a nivel servidor validando con Clerk,
-- vamos a permitir libre edición para el RLS, dado que los bloqueos los gestiona la API nuestra.

DROP POLICY IF EXISTS "Public Read Codes" ON public.promo_codes;
CREATE POLICY "Permitir TODO en promo_codes" ON public.promo_codes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Enviar Redemption" ON public.promo_redemptions;
DROP POLICY IF EXISTS "Public Ver Redemptions" ON public.promo_redemptions;
CREATE POLICY "Permitir TODO en promo_redemptions" ON public.promo_redemptions FOR ALL USING (true) WITH CHECK (true);
