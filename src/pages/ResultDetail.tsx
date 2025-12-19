import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, CheckCircle2, Clock, AlertCircle, Brain, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTests, useSubmissions } from "@/hooks/useSupabaseData";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { QuestionResult } from "@/hooks/useSupabaseData";

interface EditableQuestionResult {
  id: string;
  question_id: string;
  question_text: string;
  extracted_answer: string;
  model_answer: string;
  marks_awarded: number;
  max_marks: number;
  ai_explanation: string | null;
  ocr_confidence: number | null;
  llm_confidence: number | null;
}

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tests } = useTests();
  const { submissions, loading, updateSubmission, fetchSubmissions } = useSubmissions();

  const submission = submissions.find((s) => s.id === id);
  const test = submission?.test_id ? tests.find((t) => t.id === submission.test_id) : null;

  const [questionResults, setQuestionResults] = useState<EditableQuestionResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  // Load question results from database
  useEffect(() => {
    if (submission) {
      loadQuestionResults();
    }
  }, [submission?.id]);

  const loadQuestionResults = async () => {
    if (!submission) return;

    // First check if we have question_results in the submission already (from related table)
    if (submission.question_results && submission.question_results.length > 0) {
      const results: EditableQuestionResult[] = submission.question_results.map((qr, index) => {
        // Try to find the corresponding question from the test
        const question = test?.questions?.find(q => q.id === qr.question_id);
        
        return {
          id: qr.id,
          question_id: qr.question_id,
          question_text: question?.question_text || `Question ${index + 1}`,
          extracted_answer: qr.extracted_answer || "No answer extracted",
          model_answer: question?.correct_answer || "N/A",
          marks_awarded: qr.marks_awarded || 0,
          max_marks: qr.max_marks || question?.marks || 0,
          ai_explanation: qr.ai_explanation,
          ocr_confidence: qr.ocr_confidence,
          llm_confidence: qr.llm_confidence,
        };
      });
      setQuestionResults(results);
    } 
    // Check if grading_results JSONB has question results
    else if (submission.grading_results && typeof submission.grading_results === 'object') {
      const gradingResults = submission.grading_results as any;
      const questionResultsFromJson = gradingResults.question_results as any[];
      
      if (Array.isArray(questionResultsFromJson) && questionResultsFromJson.length > 0) {
        const results: EditableQuestionResult[] = questionResultsFromJson.map((qr, index) => ({
          id: `grading-${index}`,
          question_id: qr.question_number?.toString() || `${index + 1}`,
          question_text: qr.question || `Question ${index + 1}`,
          extracted_answer: qr.student_answer || "No answer extracted",
          model_answer: "N/A",
          marks_awarded: qr.awarded_marks || 0,
          max_marks: qr.max_marks || 0,
          ai_explanation: qr.feedback,
          ocr_confidence: null,
          llm_confidence: submission.llm_confidence,
        }));
        setQuestionResults(results);
        return;
      }
    }
    // Fall back to extracted_questions if no grading done yet
    else if (submission.extracted_questions) {
      const extractedQuestions = submission.extracted_questions as any[];
      if (Array.isArray(extractedQuestions)) {
        const results: EditableQuestionResult[] = extractedQuestions.map((eq, index) => ({
          id: `temp-${index}`,
          question_id: eq.question_number?.toString() || `${index + 1}`,
          question_text: eq.question || `Question ${index + 1}`,
          extracted_answer: eq.student_answer || "No answer extracted",
          model_answer: "Not graded yet",
          marks_awarded: 0,
          max_marks: eq.max_marks || (submission.max_marks ? submission.max_marks / extractedQuestions.length : 10),
          ai_explanation: null,
          ocr_confidence: null,
          llm_confidence: null,
        }));
        setQuestionResults(results);
      }
    }
  };

  const handleGradeWithAI = async () => {
    if (!submission) return;
    
    setIsGrading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }
      
      // Get extracted questions from submission
      const extractedQuestions = submission.extracted_questions as any[];
      if (!extractedQuestions || !Array.isArray(extractedQuestions) || extractedQuestions.length === 0) {
        throw new Error("No questions found in submission to grade. Please ensure the file was processed correctly.");
      }
      
      // Build the grading request with structured questions
      const gradingRequest = {
        submission_id: submission.id,
        questions: extractedQuestions.map((eq, index) => ({
          question_number: eq.question_number || index + 1,
          question: eq.question || `Question ${index + 1}`,
          student_answer: eq.student_answer || "",
          max_marks: eq.max_marks || (submission.max_marks ? submission.max_marks / extractedQuestions.length : 10),
          question_type: eq.question_type || "text"
        })),
        total_marks: submission.max_marks || 100,
        rubric_criteria: submission.rubric_criteria || undefined
      };
      
      const response = await fetch(`/api/v1/files/grade-exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(gradingRequest),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Grading failed: ${response.status}`);
      }
      
      toast({
        title: "Grading Complete",
        description: "The exam has been graded successfully.",
      });
      
      // Refresh data
      await fetchSubmissions();
      loadQuestionResults();
      
    } catch (error: any) {
      toast({
        title: "Grading Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGrading(false);
    }
  };

  const updateMarks = (index: number, newMarks: number) => {
    const updated = [...questionResults];
    updated[index] = { ...updated[index], marks_awarded: newMarks };
    setQuestionResults(updated);
  };

  const handleSave = async () => {
    if (!submission) return;
    
    setIsSaving(true);
    
    try {
      const totalMarks = questionResults.reduce((sum, r) => sum + r.marks_awarded, 0);
      const maxMarks = questionResults.reduce((sum, r) => sum + r.max_marks, 0);
      
      await updateSubmission(submission.id, {
        marks_obtained: totalMarks,
        max_marks: maxMarks,
        status: "graded",
        graded_at: new Date().toISOString(),
        graded_by: "manual",
      });
      
      // Also update individual question results if they exist in the database
      for (const qr of questionResults) {
        if (!qr.id.startsWith('temp-')) {
          await supabase
            .from('question_results')
            .update({ marks_awarded: qr.marks_awarded })
            .eq('id', qr.id);
        }
      }
      
      toast({
        title: "Changes saved!",
        description: "Marks have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading..." description="">
        <Skeleton className="h-96 w-full" />
      </DashboardLayout>
    );
  }

  if (!submission) {
    return (
      <DashboardLayout title="Result Not Found" description="">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Submission not found</p>
            <Button className="mt-4" onClick={() => navigate("/results")}>
              Back to Results
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const totalAwarded = submission.marks_obtained || questionResults.reduce((sum, r) => sum + r.marks_awarded, 0);
  const totalMax = submission.max_marks || questionResults.reduce((sum, r) => sum + r.max_marks, 0);
  const percentage = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;

  return (
    <DashboardLayout
      title={`Result: ${submission.student_name}`}
      description={test?.title || submission.rubric_criteria ? "Custom Rubric" : "Exam Details"}
    >
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/results")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Results
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Student</p>
              <p className="text-lg font-semibold">{submission.student_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">File</p>
              <a 
                href={submission.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                {submission.file_name}
              </a>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge 
                variant={submission.status === "graded" ? "default" : "secondary"} 
                className="mt-1"
              >
                {submission.status === "graded" ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : (
                  <Clock className="mr-1 h-3 w-3" />
                )}
                {submission.status}
              </Badge>
            </div>
            
            {/* Score Summary */}
            <div className="rounded-lg bg-secondary p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Score</span>
                <span className="text-2xl font-bold">{totalAwarded}/{totalMax}</span>
              </div>
              <Progress value={percentage} className="mt-2" />
              <p className="mt-1 text-right text-sm font-medium">{percentage}%</p>
            </div>

            {/* Confidence Metrics */}
            {(submission.llm_confidence !== null || submission.ocr_confidence !== null) && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Confidence Metrics</p>
                
                {submission.llm_confidence !== null && (
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">LLM Confidence:</span>
                    <Progress value={submission.llm_confidence * 100} className="h-1.5 flex-1" />
                    <span className="text-xs font-medium">{Math.round(submission.llm_confidence * 100)}%</span>
                  </div>
                )}
                
                {submission.ocr_confidence !== null && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">OCR Confidence:</span>
                    <Progress value={submission.ocr_confidence * 100} className="h-1.5 flex-1" />
                    <span className="text-xs font-medium">{Math.round(submission.ocr_confidence * 100)}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Overall Feedback */}
            {submission.overall_feedback && (
              <div>
                <p className="text-sm text-muted-foreground">Overall Feedback</p>
                <p className="mt-1 text-sm bg-secondary/50 p-3 rounded-lg">{submission.overall_feedback}</p>
              </div>
            )}

            {/* Graded By */}
            {submission.graded_by && submission.graded_at && (
              <div className="text-xs text-muted-foreground">
                Graded by {submission.graded_by} on {new Date(submission.graded_at).toLocaleString()}
              </div>
            )}

            <div className="space-y-2">
              {submission.status !== "graded" && (
                <Button 
                  className="w-full" 
                  onClick={handleGradeWithAI} 
                  disabled={isGrading}
                  variant="default"
                >
                  <Brain className="mr-2 h-4 w-4" />
                  {isGrading ? "Grading..." : "Grade with AI"}
                </Button>
              )}
              <Button 
                className="w-full" 
                onClick={handleSave} 
                disabled={isSaving}
                variant={submission.status === "graded" ? "default" : "outline"}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question Results */}
        <div className="space-y-4 lg:col-span-2">
          {questionResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  {submission.status === "graded" 
                    ? "No question-level results available"
                    : "This submission has not been graded yet. Click 'Grade with AI' to start."}
                </p>
              </CardContent>
            </Card>
          ) : (
            questionResults.map((result, index) => (
              <Card key={result.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Question {index + 1}</CardTitle>
                    <Badge variant="outline">{result.marks_awarded}/{result.max_marks} marks</Badge>
                  </div>
                  {result.question_text && result.question_text !== `Question ${index + 1}` && (
                    <p className="text-sm text-muted-foreground mt-1">{result.question_text}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Student Answer</Label>
                        <div className="mt-2 rounded-lg border-2 border-border bg-secondary/50 p-4 max-h-48 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">{result.extracted_answer}</p>
                        </div>
                      </div>
                      
                      {/* OCR Confidence for this question */}
                      {result.ocr_confidence !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">OCR Confidence:</span>
                          <Progress value={result.ocr_confidence * 100} className="h-1.5 flex-1" />
                          <span className="text-xs font-medium">{Math.round(result.ocr_confidence * 100)}%</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {result.model_answer && result.model_answer !== "Not graded yet" && result.model_answer !== "N/A" && (
                        <div>
                          <Label className="text-muted-foreground">Model Answer</Label>
                          <div className="mt-2 rounded-lg border-2 border-border bg-muted/30 p-4 max-h-48 overflow-y-auto">
                            <p className="text-sm whitespace-pre-wrap">{result.model_answer}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* AI Explanation */}
                      {result.ai_explanation && (
                        <div>
                          <Label className="text-muted-foreground">AI Feedback</Label>
                          <p className="mt-2 text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg">
                            {result.ai_explanation}
                          </p>
                        </div>
                      )}
                      
                      {/* LLM Confidence for this question */}
                      {result.llm_confidence !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">LLM Confidence:</span>
                          <Progress value={result.llm_confidence * 100} className="h-1.5 flex-1" />
                          <span className="text-xs font-medium">{Math.round(result.llm_confidence * 100)}%</span>
                        </div>
                      )}
                      
                      {/* Marks Editor */}
                      <div>
                        <Label htmlFor={`marks-${index}`}>Marks Awarded</Label>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            id={`marks-${index}`}
                            type="number"
                            min={0}
                            max={result.max_marks}
                            value={result.marks_awarded}
                            onChange={(e) => updateMarks(index, Math.min(parseFloat(e.target.value) || 0, result.max_marks))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">out of {result.max_marks}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
