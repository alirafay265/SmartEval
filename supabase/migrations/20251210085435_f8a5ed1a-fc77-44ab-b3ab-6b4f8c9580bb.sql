-- Add test_file_url column to tests table to allow uploaded tests
ALTER TABLE public.tests 
ADD COLUMN test_file_url text;

-- Make questions optional by not requiring questions for a test
-- (no foreign key constraint change needed since questions reference tests, not the other way around)