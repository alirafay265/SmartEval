import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { submissions, tests, updateSubmission } = useAppStore();

  const submission = submissions.find((s) => s.id === id);
  const test = submission ? tests.find((t) => t.id === submission.testId) : null;

  const [editedResults, setEditedResults] = useState(submission?.results || []);
  const [isSaving, setIsSaving] = useState(false);

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

  const updateMarks = (questionIndex: number, newMarks: number) => {
    const updated = [...editedResults];
    updated[questionIndex] = { ...updated[questionIndex], marksAwarded: newMarks };
    setEditedResults(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    
    const totalMarks = editedResults.reduce((sum, r) => sum + r.marksAwarded, 0);
    const maxMarks = editedResults.reduce((sum, r) => sum + r.maxMarks, 0);
    
    setTimeout(() => {
      updateSubmission(submission.id, {
        results: editedResults,
        marksObtained: totalMarks,
        maxMarks: maxMarks,
      });
      
      setIsSaving(false);
      toast({
        title: "Changes saved!",
        description: "Marks have been updated successfully.",
      });
    }, 500);
  };

  const totalAwarded = editedResults.reduce((sum, r) => sum + r.marksAwarded, 0);
  const totalMax = editedResults.reduce((sum, r) => sum + r.maxMarks, 0);
  const percentage = Math.round((totalAwarded / totalMax) * 100);

  return (
    <DashboardLayout
      title={`Result: ${submission.studentName}`}
      description={test?.title || "Exam Details"}
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
              <p className="text-lg font-semibold">{submission.studentName}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">File</p>
              <p className="font-medium">{submission.fileName}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="default" className="mt-1">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Completed
              </Badge>
            </div>

            <div className="rounded-lg bg-secondary p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Score</span>
                <span className="text-2xl font-bold">
                  {totalAwarded}/{totalMax}
                </span>
              </div>
              <Progress value={percentage} className="mt-2" />
              <p className="mt-1 text-right text-sm font-medium">{percentage}%</p>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Questions Detail */}
        <div className="space-y-4 lg:col-span-2">
          {editedResults.map((result, index) => (
            <Card key={result.questionId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Question {index + 1}</CardTitle>
                  <Badge variant="outline">
                    {result.marksAwarded}/{result.maxMarks} marks
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Left: Student Answer */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Extracted Answer</Label>
                      <div className="mt-2 rounded-lg border-2 border-border bg-secondary/50 p-4">
                        <p className="text-sm">{result.extractedAnswer}</p>
                      </div>
                    </div>

                    {result.ocrConfidence !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">OCR Confidence:</span>
                        <Progress value={result.ocrConfidence * 100} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium">
                          {Math.round(result.ocrConfidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Grading */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Model Answer</Label>
                      <div className="mt-2 rounded-lg border-2 border-border bg-surface-elevated p-4">
                        <p className="text-sm">{result.modelAnswer}</p>
                      </div>
                    </div>

                    {result.aiExplanation && (
                      <div>
                        <Label className="text-muted-foreground">AI Explanation</Label>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {result.aiExplanation}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor={`marks-${index}`}>Marks Awarded</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          id={`marks-${index}`}
                          type="number"
                          min={0}
                          max={result.maxMarks}
                          value={result.marksAwarded}
                          onChange={(e) =>
                            updateMarks(index, Math.min(parseInt(e.target.value) || 0, result.maxMarks))
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          out of {result.maxMarks}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
