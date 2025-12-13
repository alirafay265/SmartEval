-- Add content column to submissions table to store extracted text
ALTER TABLE public.submissions 
ADD COLUMN content text;

-- Add extracted_questions column to store structured question-answer data as JSON
ALTER TABLE public.submissions 
ADD COLUMN extracted_questions jsonb;