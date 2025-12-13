import { create } from 'zustand';

export interface Question {
  id: string;
  type: 'mcq' | 'numeric' | 'subjective';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
  rubric?: string;
}

export interface Test {
  id: string;
  courseName: string;
  title: string;
  examType: 'quiz' | 'assignment' | 'midterm' | 'final';
  questions: Question[];
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  email: string;
}

export interface StudentList {
  id: string;
  name: string;
  students: Student[];
  createdAt: string;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  testId: string;
  fileUrl: string;
  fileName: string;
  status: 'ungraded' | 'graded';
  marksObtained?: number;
  maxMarks?: number;
  results?: QuestionResult[];
  uploadedAt: string;
}

export interface QuestionResult {
  questionId: string;
  extractedAnswer: string;
  modelAnswer: string;
  marksAwarded: number;
  maxMarks: number;
  aiExplanation?: string;
  ocrConfidence?: number;
}

interface AppState {
  tests: Test[];
  studentLists: StudentList[];
  submissions: Submission[];
  addTest: (test: Test) => void;
  addStudentList: (list: StudentList) => void;
  addSubmission: (submission: Submission) => void;
  updateSubmission: (id: string, updates: Partial<Submission>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tests: [],
  studentLists: [],
  submissions: [],
  addTest: (test) => set((state) => ({ tests: [...state.tests, test] })),
  addStudentList: (list) => set((state) => ({ studentLists: [...state.studentLists, list] })),
  addSubmission: (submission) => set((state) => ({ submissions: [...state.submissions, submission] })),
  updateSubmission: (id, updates) =>
    set((state) => ({
      submissions: state.submissions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
}));
