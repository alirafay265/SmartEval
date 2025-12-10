import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

// Types
export type Test = Tables<'tests'> & { questions?: Question[] };
export type Question = Tables<'questions'>;
export type StudentList = Tables<'student_lists'> & { students?: Student[] };
export type Student = Tables<'students'>;
export type Submission = Tables<'submissions'> & { question_results?: QuestionResult[] };
export type QuestionResult = Tables<'question_results'>;

// Hook for Tests
export function useTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tests')
      .select('*, questions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to load tests', variant: 'destructive' });
    } else {
      setTests(data || []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const addTest = async (testData: Omit<TablesInsert<'tests'>, 'user_id'>, questions?: Omit<TablesInsert<'questions'>, 'test_id'>[]) => {
    if (!user) return null;
    
    const { data: test, error } = await supabase
      .from('tests')
      .insert({ ...testData, user_id: user.id })
      .select()
      .single();
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to create test', variant: 'destructive' });
      return null;
    }

    if (questions && questions.length > 0) {
      const questionsWithTestId = questions.map((q, index) => ({
        ...q,
        test_id: test.id,
        order_index: index,
      }));
      
      const { error: qError } = await supabase
        .from('questions')
        .insert(questionsWithTestId);
      
      if (qError) {
        toast({ title: 'Warning', description: 'Test created but questions failed to save', variant: 'destructive' });
      }
    }

    await fetchTests();
    return test;
  };

  const deleteTest = async (testId: string) => {
    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete test', variant: 'destructive' });
      return false;
    }
    
    await fetchTests();
    return true;
  };

  return { tests, loading, fetchTests, addTest, deleteTest };
}

// Hook for Student Lists
export function useStudentLists() {
  const [studentLists, setStudentLists] = useState<StudentList[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchStudentLists = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('student_lists')
      .select('*, students(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to load student lists', variant: 'destructive' });
    } else {
      setStudentLists(data || []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchStudentLists();
  }, [fetchStudentLists]);

  const addStudentList = async (name: string, students: Omit<TablesInsert<'students'>, 'student_list_id'>[]) => {
    if (!user) return null;
    
    const { data: list, error } = await supabase
      .from('student_lists')
      .insert({ name, user_id: user.id })
      .select()
      .single();
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to create student list', variant: 'destructive' });
      return null;
    }

    if (students.length > 0) {
      const studentsWithListId = students.map(s => ({
        ...s,
        student_list_id: list.id,
      }));
      
      const { error: sError } = await supabase
        .from('students')
        .insert(studentsWithListId);
      
      if (sError) {
        toast({ title: 'Warning', description: 'List created but students failed to save', variant: 'destructive' });
      }
    }

    await fetchStudentLists();
    return list;
  };

  const deleteStudentList = async (listId: string) => {
    const { error } = await supabase
      .from('student_lists')
      .delete()
      .eq('id', listId);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete student list', variant: 'destructive' });
      return false;
    }
    
    await fetchStudentLists();
    return true;
  };

  return { studentLists, loading, fetchStudentLists, addStudentList, deleteStudentList };
}

// Hook for Submissions
export function useSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*, question_results(*)')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to load submissions', variant: 'destructive' });
    } else {
      setSubmissions(data || []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const addSubmission = async (submissionData: Omit<TablesInsert<'submissions'>, 'user_id'>) => {
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('submissions')
      .insert({ ...submissionData, user_id: user.id })
      .select()
      .single();
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to create submission', variant: 'destructive' });
      return null;
    }

    await fetchSubmissions();
    return data;
  };

  const updateSubmission = async (id: string, updates: Partial<TablesInsert<'submissions'>>) => {
    const { error } = await supabase
      .from('submissions')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update submission', variant: 'destructive' });
      return false;
    }
    
    await fetchSubmissions();
    return true;
  };

  const deleteSubmission = async (id: string) => {
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete submission', variant: 'destructive' });
      return false;
    }
    
    await fetchSubmissions();
    return true;
  };

  return { submissions, loading, fetchSubmissions, addSubmission, updateSubmission, deleteSubmission };
}

// Upload file to Supabase storage
export async function uploadToStorage(bucket: string, path: string, file: File) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  
  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}
