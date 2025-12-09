-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'user');

-- Create enum for exam types
CREATE TYPE public.exam_type AS ENUM ('quiz', 'assignment', 'midterm', 'final');

-- Create enum for question types
CREATE TYPE public.question_type AS ENUM ('mcq', 'numeric', 'subjective');

-- Create enum for submission status
CREATE TYPE public.submission_status AS ENUM ('pending', 'processing', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create tests table
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_name TEXT NOT NULL,
  title TEXT NOT NULL,
  exam_type exam_type NOT NULL DEFAULT 'quiz',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  question_type question_type NOT NULL DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  rubric TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create student_lists table
CREATE TABLE public.student_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_lists ENABLE ROW LEVEL SECURITY;

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_list_id UUID REFERENCES public.student_lists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status submission_status NOT NULL DEFAULT 'pending',
  marks_obtained NUMERIC,
  max_marks NUMERIC,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Create question_results table
CREATE TABLE public.question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  extracted_answer TEXT,
  marks_awarded NUMERIC NOT NULL DEFAULT 0,
  ai_explanation TEXT,
  ocr_confidence NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.question_results ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_lists_updated_at
  BEFORE UPDATE ON public.student_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Tests policies
CREATE POLICY "Users can view their own tests"
  ON public.tests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tests"
  ON public.tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tests"
  ON public.tests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tests"
  ON public.tests FOR DELETE
  USING (auth.uid() = user_id);

-- Questions policies
CREATE POLICY "Users can view questions of their tests"
  ON public.questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tests
    WHERE tests.id = questions.test_id
    AND tests.user_id = auth.uid()
  ));

CREATE POLICY "Users can create questions for their tests"
  ON public.questions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tests
    WHERE tests.id = questions.test_id
    AND tests.user_id = auth.uid()
  ));

CREATE POLICY "Users can update questions of their tests"
  ON public.questions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.tests
    WHERE tests.id = questions.test_id
    AND tests.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete questions of their tests"
  ON public.questions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tests
    WHERE tests.id = questions.test_id
    AND tests.user_id = auth.uid()
  ));

-- Student lists policies
CREATE POLICY "Users can view their own student lists"
  ON public.student_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own student lists"
  ON public.student_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own student lists"
  ON public.student_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own student lists"
  ON public.student_lists FOR DELETE
  USING (auth.uid() = user_id);

-- Students policies
CREATE POLICY "Users can view students in their lists"
  ON public.students FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.student_lists
    WHERE student_lists.id = students.student_list_id
    AND student_lists.user_id = auth.uid()
  ));

CREATE POLICY "Users can create students in their lists"
  ON public.students FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.student_lists
    WHERE student_lists.id = students.student_list_id
    AND student_lists.user_id = auth.uid()
  ));

CREATE POLICY "Users can update students in their lists"
  ON public.students FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.student_lists
    WHERE student_lists.id = students.student_list_id
    AND student_lists.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete students in their lists"
  ON public.students FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.student_lists
    WHERE student_lists.id = students.student_list_id
    AND student_lists.user_id = auth.uid()
  ));

-- Submissions policies
CREATE POLICY "Users can view their own submissions"
  ON public.submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
  ON public.submissions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own submissions"
  ON public.submissions FOR DELETE
  USING (auth.uid() = user_id);

-- Question results policies
CREATE POLICY "Users can view results of their submissions"
  ON public.question_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = question_results.submission_id
    AND submissions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create results for their submissions"
  ON public.question_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = question_results.submission_id
    AND submissions.user_id = auth.uid()
  ));

CREATE POLICY "Users can update results of their submissions"
  ON public.question_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = question_results.submission_id
    AND submissions.user_id = auth.uid()
  ));

-- Create storage bucket for exam uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-uploads', 'exam-uploads', false);

-- Storage policies
CREATE POLICY "Users can upload their own exam files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own exam files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own exam files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);