-- Add rubric_criteria column to submissions table and make test_id nullable
ALTER TABLE public.submissions 
ADD COLUMN rubric_criteria TEXT NULL;

-- Make test_id nullable (allow submissions without specific tests)
ALTER TABLE public.submissions 
ALTER COLUMN test_id DROP NOT NULL;

-- Update the foreign key constraint to handle nulls properly
ALTER TABLE public.submissions 
DROP CONSTRAINT IF EXISTS submissions_test_id_fkey;

ALTER TABLE public.submissions 
ADD CONSTRAINT submissions_test_id_fkey 
FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE SET NULL;

-- Add a comment explaining the rubric_criteria field
COMMENT ON COLUMN public.submissions.rubric_criteria IS 'Custom grading criteria used when no specific test is selected';