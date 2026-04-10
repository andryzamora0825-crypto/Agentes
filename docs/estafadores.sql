-- ============================================================
-- ── ESTAFADORES: Tabla y Storage Bucket  ────────────────────
-- NOTA: ¡DESACTIVA EL TRADUCTOR DE GOOGLE ANTES DE EJECUTAR!
-- ============================================================
CREATE TABLE IF NOT EXISTS scammers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  name TEXT,
  description TEXT,
  photo_url TEXT,
  proof_urls TEXT[] DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que la tabla no tenga bloqueos RLS y sea accesible por la API anónima
ALTER TABLE scammers DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE scammers TO anon, authenticated, service_role;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('scammers-evidence', 'scammers-evidence', true) 
ON CONFLICT (id) DO NOTHING;

-- Dar permisos (Policies) para poder subir y leer imágenes libremente
DROP POLICY IF EXISTS "Permitir_subidas_publicas" ON storage.objects;
CREATE POLICY "Permitir_subidas_publicas" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'scammers-evidence');

DROP POLICY IF EXISTS "Permitir_lectura_publica" ON storage.objects;
CREATE POLICY "Permitir_lectura_publica" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'scammers-evidence');
