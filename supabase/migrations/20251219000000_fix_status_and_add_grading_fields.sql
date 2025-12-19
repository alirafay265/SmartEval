-- Fix submission_status enum and add grading result fields
-- This migration updates the schema for proper grading workflow

-- First, let's update the submission_status enum to use 'ungraded' and 'graded'
-- Since we can't easily alter an enum, we'll create a new one and migrate

-- Drop the old enum type (we need to handle columns using it first)
ALTER TABLE public.submissions 
ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.submissions 
ALTER COLUMN status TYPE TEXT;

DROP TYPE IF EXISTS public.submission_status;

-- Create the new enum with correct values
CREATE TYPE public.submission_status AS ENUM ('ungraded', 'graded');

-- Convert existing values and set new column type
UPDATE public.submissions SET status = 'ungraded' WHERE status IN ('pending', 'processing');
UPDATE public.submissions SET status = 'graded' WHERE status = 'completed';

ALTER TABLE public.submissions 
ALTER COLUMN status TYPE public.submission_status USING status::public.submission_status;

ALTER TABLE public.submissions 
ALTER COLUMN status SET DEFAULT 'ungraded';

-- Add new fields for grading results
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS llm_confidence NUMERIC CHECK (llm_confidence >= 0 AND llm_confidence <= 1),
ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
ADD COLUMN IF NOT EXISTS overall_feedback TEXT,
ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS graded_by TEXT DEFAULT 'ai',
ADD COLUMN IF NOT EXISTS grading_results JSONB;

-- Add llm_confidence to question_results for per-question confidence
ALTER TABLE public.question_results
ADD COLUMN IF NOT EXISTS llm_confidence NUMERIC CHECK (llm_confidence >= 0 AND llm_confidence <= 1),
ADD COLUMN IF NOT EXISTS max_marks NUMERIC NOT NULL DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.submissions.llm_confidence IS 'Overall confidence of LLM grading (0-1)';
COMMENT ON COLUMN public.submissions.ocr_confidence IS 'Overall OCR confidence when extracting text (0-1)';
COMMENT ON COLUMN public.submissions.overall_feedback IS 'Overall feedback from LLM about the submission';
COMMENT ON COLUMN public.submissions.graded_at IS 'Timestamp when the submission was graded';
COMMENT ON COLUMN public.submissions.graded_by IS 'Who/what graded the submission (ai, teacher name, etc)';
COMMENT ON COLUMN public.submissions.grading_results IS 'Full grading results as JSONB including question-by-question breakdown';
COMMENT ON COLUMN public.question_results.llm_confidence IS 'Confidence of LLM grading for this question (0-1)';
COMMENT ON COLUMN public.question_results.max_marks IS 'Maximum marks for this question';
