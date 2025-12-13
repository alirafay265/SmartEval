import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  BookOpen,
  Target,
  TrendingUp
} from 'lucide-react';

interface ExamQuestion {
  question_number: number;
  question: string;
  student_answer: string;
  max_marks: number;
  question_type: string;
}

interface QuestionGradingResult {
  question_number: number;
  question: string;
  student_answer: string;
  max_marks: number;
  awarded_marks: number;
  feedback: string;
  percentage: number;
}

interface ExamGradingResult {
  total_questions: number;
  total_max_marks: number;
  total_awarded_marks: number;
  overall_percentage: number;
  overall_feedback: string;
  question_results: QuestionGradingResult[];
}

interface ExamProcessingResponse {
  filename: string;
  extracted_text: string;
  parsed_questions: ExamQuestion[];
  total_questions: number;
}

export const ExamUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [processedExam, setProcessedExam] = useState<ExamProcessingResponse | null>(null);
  const [gradingResult, setGradingResult] = useState<ExamGradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExtractedText, setShowExtractedText] = useState(false);

  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
  const allowedExtensions = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!allowedTypes.includes(selectedFile.type) && 
        !allowedExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext))) {
      setError('Only PDF, DOCX, JPG, and PNG files are allowed');
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setProcessedExam(null);
    setGradingResult(null);
  };

  const processExam = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Get session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('🔄 ExamUploader processing file:', file.name);
      console.log('📧 Session user:', session?.user?.email);
      console.log('🔑 Access token available:', !!session?.access_token);
      
      const response = await fetch('/api/v1/files/process-exam', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      
      console.log('📡 Response status:', response.status);

      const result = await response.json();

      if (result.success) {
        setProcessedExam(result.data);
      } else {
        setError(result.message || 'Failed to process exam file');
      }
    } catch (err) {
      setError('Failed to process exam file. Please try again.');
      console.error('Error processing exam:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const gradeExam = async () => {
    if (!processedExam) return;

    setIsGrading(true);
    setError(null);

    try {
      // Get session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('🎯 Grading exam with', processedExam.parsed_questions.length, 'questions');
      console.log('🔑 Auth token for grading:', !!session?.access_token);
      
      const response = await fetch('/api/v1/files/grade-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          questions: processedExam.parsed_questions
        }),
      });
      
      console.log('📊 Grading response status:', response.status);

      const result = await response.json();

      if (result.success) {
        setGradingResult(result.data);
      } else {
        setError(result.message || 'Failed to grade exam');
      }
    } catch (err) {
      setError('Failed to grade exam. Please try again.');
      console.error('Error grading exam:', err);
    } finally {
      setIsGrading(false);
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 80) return 'bg-blue-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreGrade = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            AI-Powered Exam Grading
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label 
              htmlFor="exam-file" 
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileText className="w-8 h-8 mb-2 text-gray-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> your exam file
                </p>
                <p className="text-xs text-gray-500">PDF, DOCX, JPG, or PNG (MAX. 10MB)</p>
              </div>
              <input 
                id="exam-file" 
                type="file" 
                className="hidden" 
                onChange={handleFileSelect}
                accept=".pdf,.docx,.jpg,.jpeg,.png"
              />
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{file.name}</span>
                <Badge variant="outline">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </Badge>
              </div>
              <Button
                onClick={processExam}
                disabled={isProcessing}
                size="sm"
              >
                {isProcessing ? 'Processing...' : 'Process Exam'}
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {processedExam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Processed Exam Structure
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExtractedText(!showExtractedText)}
                >
                  {showExtractedText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showExtractedText ? 'Hide' : 'Show'} Extracted Text
                </Button>
                <Button
                  onClick={gradeExam}
                  disabled={isGrading}
                >
                  {isGrading ? 'Grading...' : 'Grade with AI'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{processedExam.total_questions}</div>
                <div className="text-sm text-gray-500">Questions Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {processedExam.parsed_questions.reduce((sum, q) => sum + q.max_marks, 0)}
                </div>
                <div className="text-sm text-gray-500">Total Marks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{processedExam.filename}</div>
                <div className="text-sm text-gray-500">File Processed</div>
              </div>
            </div>

            {showExtractedText && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Extracted Text:</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {processedExam.extracted_text}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-semibold">Parsed Questions:</h4>
              {processedExam.parsed_questions.map((question, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">Q{question.question_number}: {question.question}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Answer:</strong> {question.student_answer.length > 100 
                              ? question.student_answer.substring(0, 100) + '...' 
                              : question.student_answer}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{question.max_marks} marks</Badge>
                          <div className="text-xs text-gray-500 mt-1">{question.question_type}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {gradingResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Grading Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score */}
            <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-4xl font-bold">
                  {gradingResult.total_awarded_marks.toFixed(1)}/{gradingResult.total_max_marks}
                </div>
                <Badge 
                  className={`${getScoreColor(gradingResult.overall_percentage)} text-white text-lg px-3 py-1`}
                >
                  {getScoreGrade(gradingResult.overall_percentage)} ({gradingResult.overall_percentage.toFixed(1)}%)
                </Badge>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className={`h-3 rounded-full ${getScoreColor(gradingResult.overall_percentage)}`}
                  style={{ width: `${Math.min(gradingResult.overall_percentage, 100)}%` }}
                ></div>
              </div>
              
              <p className="text-sm text-gray-700 italic">"{gradingResult.overall_feedback}"</p>
            </div>

            {/* Question Results */}
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Question-by-Question Results
              </h4>
              <div className="space-y-4">
                {gradingResult.question_results.map((result, index) => (
                  <Card key={index} className={`border-l-4 ${result.percentage >= 70 ? 'border-l-green-500' : result.percentage >= 50 ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">Q{result.question_number}: {result.question}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {result.student_answer.length > 80 
                              ? result.student_answer.substring(0, 80) + '...' 
                              : result.student_answer}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {result.awarded_marks.toFixed(1)}/{result.max_marks}
                          </div>
                          <Badge 
                            variant={result.percentage >= 70 ? "default" : result.percentage >= 50 ? "secondary" : "destructive"}
                          >
                            {result.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm"><strong>Feedback:</strong> {result.feedback}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExamUploader;