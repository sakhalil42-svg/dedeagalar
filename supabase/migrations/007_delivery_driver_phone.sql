-- Add driver_phone column to deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS driver_phone TEXT;
