import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, RefreshCw, ClipboardList } from "lucide-react";
import { useTests, useSubmissions } from "@/hooks/useSupabaseData";
import { Skeleton } from "@/components/ui/skeleton";

export default function Results() {
  const navigate = useNavigate();
  const { tests } = useTests();
  const { submissions, loading, updateSubmission } = useSubmissions();
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const getTestName = (testId: string) => {
    const test = tests.find((t) => t.id === testId);
    return test?.title || "Unknown Test";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const simulateAICheck = async (submissionId: string) => {
    setRefreshing(submissionId);
    
    await updateSubmission(submissionId, { status: "processing" });
    
    setTimeout(async () => {
      const maxMarks = 100;
      const marksObtained = Math.floor(Math.random() * 40) + 60;
      
      await updateSubmission(submissionId, {
        status: "completed",
        marks_obtained: marksObtained,
        max_marks: maxMarks,
        processed_at: new Date().toISOString(),
      });
      
      setRefreshing(null);
    }, 2000);
  };

  return (
    <DashboardLayout
      title="Results"
      description="View and manage AI grading results for all submissions."
    >
      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : submissions.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-secondary p-4">
              <ClipboardList className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No submissions yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Upload student exams to start the AI grading process.
            </p>
            <Button className="mt-6" onClick={() => navigate("/upload")}>
              Upload Exams
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Submissions ({submissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Marks</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => {
                  const percentage = submission.max_marks
                    ? Math.round((submission.marks_obtained! / submission.max_marks) * 100)
                    : null;

                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {submission.student_name}
                      </TableCell>
                      <TableCell>{getTestName(submission.test_id)}</TableCell>
                      <TableCell>{getStatusBadge(submission.status)}</TableCell>
                      <TableCell className="text-right">
                        {submission.status === "completed"
                          ? `${submission.marks_obtained}/${submission.max_marks}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {percentage !== null ? `${percentage}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {submission.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => simulateAICheck(submission.id)}
                              disabled={refreshing === submission.id}
                            >
                              <RefreshCw
                                className={`mr-2 h-4 w-4 ${
                                  refreshing === submission.id ? "animate-spin" : ""
                                }`}
                              />
                              Check
                            </Button>
                          )}
                          {submission.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/results/${submission.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
