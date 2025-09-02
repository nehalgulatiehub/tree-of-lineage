-- Add alive status and photo upload columns to family_members table
ALTER TABLE public.family_members 
ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS photo_file_path TEXT;