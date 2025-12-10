import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Save, ChevronDown, ChevronUp, Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTests, uploadToStorage } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Question {
  id: string;
  type: 'mcq' | 'numeric' | 'subjective';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
  rubric?: string;
}

interface QuestionFormProps {
  question: Question;
  index: number;
  onUpdate: (id: string, updates: Partial<Question>) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function QuestionForm({ question, index, onUpdate, onDelete, isExpanded, onToggle }: QuestionFormProps) {
  return (
    <Card className="border-2">
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              Question {index + 1}
              {question.questionText && (
                <span className="ml-2 font-normal text-muted-foreground">
                  - {question.questionText.slice(0, 50)}
                  {question.questionText.length > 50 ? "..." : ""}
                </span>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
              {question.type.toUpperCase()} • {question.marks} marks
            </span>
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select
                value={question.type}
                onValueChange={(value: 'mcq' | 'numeric' | 'subjective') =>
                  onUpdate(question.id, { type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="subjective">Subjective</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Marks</Label>
              <Input
                type="number"
                min={1}
                value={question.marks}
                onChange={(e) => onUpdate(question.id, { marks: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Question Text</Label>
            <Textarea
              placeholder="Enter your question here..."
              value={question.questionText}
              onChange={(e) => onUpdate(question.id, { questionText: e.target.value })}
              rows={3}
            />
          </div>

          {question.type === "mcq" && (
            <div className="space-y-2">
              <Label>Options (one per line)</Label>
              <Textarea
                placeholder="A. First option&#10;B. Second option&#10;C. Third option&#10;D. Fourth option"
                value={question.options?.join("\n") || ""}
                onChange={(e) =>
                  onUpdate(question.id, { options: e.target.value.split("\n").filter(Boolean) })
                }
                rows={4}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>
              {question.type === "mcq" ? "Correct Answer (e.g., A)" : "Model Answer"}
            </Label>
            <Textarea
              placeholder={
                question.type === "mcq"
                  ? "A"
                  : question.type === "numeric"
                  ? "42"
                  : "Enter the model answer for AI grading..."
              }
              value={question.correctAnswer}
              onChange={(e) => onUpdate(question.id, { correctAnswer: e.target.value })}
              rows={question.type === "subjective" ? 4 : 2}
            />
          </div>

          <div className="space-y-2">
            <Label>Rubric (Optional)</Label>
            <Textarea
              placeholder="Grading rubric for AI evaluation..."
              value={question.rubric || ""}
              onChange={(e) => onUpdate(question.id, { rubric: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onDelete(question.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Question
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function CreateTest() {
  const [courseName, setCourseName] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [examType, setExamType] = useState<'quiz' | 'assignment' | 'midterm' | 'final'>("quiz");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const { toast } = useToast();
  const { addTest } = useTests();
  const { user } = useAuth();
  const navigate = useNavigate();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setTestFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: false,
  });

  const addQuestion = () => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      type: "mcq",
      questionText: "",
      options: [],
      correctAnswer: "",
      marks: 1,
      rubric: "",
    };
    setQuestions([...questions, newQuestion]);
    setExpandedId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleSave = async () => {
    if (!courseName.trim() || !testTitle.trim()) {
      toast({
        title: "Error",
        description: "Please fill in the course name and test title",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0 && !testFile) {
      toast({
        title: "Error",
        description: "Please add at least one question or upload a test file",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      let testFileUrl: string | undefined;

      if (testFile && user) {
        setUploadingFile(true);
        const filePath = `${user.id}/tests/${Date.now()}-${testFile.name}`;
        testFileUrl = await uploadToStorage('exam-uploads', filePath, testFile);
        setUploadingFile(false);
      }

      const questionsData = questions.length > 0 ? questions.map((q) => ({
        question_text: q.questionText,
        question_type: q.type as 'mcq' | 'numeric' | 'subjective',
        correct_answer: q.correctAnswer,
        marks: q.marks,
        rubric: q.rubric || null,
        options: q.options ? q.options : null,
      })) : undefined;

      const test = await addTest(
        {
          course_name: courseName,
          title: testTitle,
          exam_type: examType,
          test_file_url: testFileUrl,
        },
        questionsData
      );

      if (test) {
        toast({
          title: "Test saved!",
          description: `"${testTitle}" has been created successfully.`,
        });
        navigate("/dashboard");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setUploadingFile(false);
    }
  };

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <DashboardLayout
      title="Create Test"
      description="Create a new exam or quiz with questions or upload a test file."
    >
      <div className="mx-auto max-w-4xl">
        {/* Test Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name</Label>
                <Input
                  id="courseName"
                  placeholder="e.g., Mathematics 101"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testTitle">Test Title</Label>
                <Input
                  id="testTitle"
                  placeholder="e.g., Midterm Exam 2024"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Exam Type</Label>
              <Select value={examType} onValueChange={(v: typeof examType) => setExamType(v)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="midterm">Midterm</SelectItem>
                  <SelectItem value="final">Final Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Questions or Upload */}
        <Tabs defaultValue="questions" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions">Add Questions Manually</TabsTrigger>
            <TabsTrigger value="upload">Upload Test File</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Questions</h2>
                <p className="text-sm text-muted-foreground">
                  {questions.length} question{questions.length !== 1 ? "s" : ""} • {totalMarks} total marks
                </p>
              </div>
              <Button onClick={addQuestion}>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.length === 0 ? (
                <Card className="border-2 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-secondary p-3">
                      <Plus className="h-6 w-6" />
                    </div>
                    <p className="mt-4 font-medium">No questions yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Click "Add Question" to start building your test
                    </p>
                    <Button className="mt-4" onClick={addQuestion}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Question
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                questions.map((question, index) => (
                  <QuestionForm
                    key={question.id}
                    question={question}
                    index={index}
                    onUpdate={updateQuestion}
                    onDelete={deleteQuestion}
                    isExpanded={expandedId === question.id}
                    onToggle={() => setExpandedId(expandedId === question.id ? null : question.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div
                  {...getRootProps()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
                    isDragActive
                      ? "border-foreground bg-secondary"
                      : "border-border hover:border-foreground/50 hover:bg-secondary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-secondary p-4">
                      <Upload className="h-8 w-8" />
                    </div>
                    <p className="mt-4 text-lg font-medium">
                      {isDragActive ? "Drop file here" : "Drag & drop test file here"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      or click to browse • PDF, PNG, JPG supported
                    </p>
                    <Button variant="outline" className="mt-4">
                      Browse Files
                    </Button>
                  </div>
                </div>

                {testFile && (
                  <div className="mt-4 flex items-center gap-4 rounded-lg border-2 border-border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{testFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(testFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setTestFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} disabled={isSaving || uploadingFile}>
            <Save className="mr-2 h-4 w-4" />
            {uploadingFile ? "Uploading..." : isSaving ? "Saving..." : "Save Test"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
