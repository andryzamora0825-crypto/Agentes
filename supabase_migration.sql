-- Ejecuta este comando en el editor SQL de tu panel de Supabase
-- Agrega las nuevas columnas para soportar la automatización de Moderadores

ALTER TABLE social_settings 
ADD COLUMN IF NOT EXISTS moderators_list TEXT[],
ADD COLUMN IF NOT EXISTS moderator_target_network TEXT;

-- Opcional: Asegurarse que se actualiza el timestamp
-- Puedes hacerlo si lo ves pertinente, o usar los triggers ya existentes de Supabase.
