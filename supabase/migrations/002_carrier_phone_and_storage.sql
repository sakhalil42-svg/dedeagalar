-- Add carrier_phone to deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS carrier_phone text;

-- Create delivery-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "authenticated_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'delivery-photos');

-- Allow public read access to photos
CREATE POLICY "public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'delivery-photos');

-- Allow authenticated users to delete their photos
CREATE POLICY "authenticated_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'delivery-photos');
