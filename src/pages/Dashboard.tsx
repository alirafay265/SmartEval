import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Users,
  Upload,
  ClipboardList,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useTests, useStudentLists, useSubmissions } from "@/hooks/useSupabaseData";
import { Skeleton } from "@/components/ui/skeleton";

const quickActions = [
  {
    title: "Create Test",
    description: "Create a new exam or quiz",
    icon: FileText,
    href: "/create-test",
  },
  {
    title: "Manage Students",
    description: "Add or import student lists",
    icon: Users,
    href: "/students",
  },
  {
    title: "Upload Exams",
    description: "Upload student submissions",
    icon: Upload,
    href: "/upload",
  },
  {
    title: "View Results",
    description: "Check grading results",
    icon: ClipboardList,
    href: "/results",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { tests, loading: testsLoading } = useTests();
  const { studentLists, loading: listsLoading } = useStudentLists();
  const { submissions, loading: submissionsLoading } = useSubmissions();

  const loading = testsLoading || listsLoading || submissionsLoading;

  const stats = [
    {
      title: "Total Tests",
      value: tests.length.toString(),
      icon: FileText,
      change: "+2 this week",
    },
    {
      title: "Student Lists",
      value: studentLists.length.toString(),
      icon: Users,
      change: "Active",
    },
    {
      title: "Submissions",
      value: submissions.length.toString(),
      icon: Upload,
      change: "Pending review",
    },
    {
      title: "Graded",
      value: submissions.filter((s) => s.status === "completed").length.toString(),
      icon: CheckCircle2,
      change: "Completed",
    },
  ];

  return (
    <DashboardLayout
      title="Dashboard"
      description="Welcome back! Here's an overview of your exam grading platform."
    >
      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:shadow-card-hover transition-all hover:border-foreground/20"
              onClick={() => navigate(action.href)}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : tests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No tests created yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/create-test")}
                >
                  Create your first test
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tests.slice(0, 5).map((test) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium">{test.title}</p>
                      <p className="text-sm text-muted-foreground">{test.course_name}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {test.exam_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No submissions yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/upload")}
                >
                  Upload first submission
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.slice(0, 5).map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium">{submission.student_name}</p>
                      <p className="text-sm text-muted-foreground">{submission.file_name}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        submission.status === "completed"
                          ? "bg-foreground text-background"
                          : submission.status === "processing"
                          ? "bg-secondary"
                          : "bg-muted"
                      }`}
                    >
                      {submission.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
