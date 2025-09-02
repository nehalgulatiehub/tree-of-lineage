-- Create storage bucket for family photos
INSERT INTO storage.buckets (id, name, public) VALUES ('family-photos', 'family-photos', true);

-- Create policies for family photo uploads
CREATE POLICY "Users can view their own family photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'family-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own family photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'family-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own family photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'family-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own family photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'family-photos' AND auth.uid()::text = (storage.foldername(name))[1]);