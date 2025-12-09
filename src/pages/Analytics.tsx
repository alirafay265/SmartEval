import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Award, Target, BarChart3 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useState } from "react";

export default function Analytics() {
  const { submissions, tests } = useAppStore();
  const [selectedTest, setSelectedTest] = useState<string>("all");

  const filteredSubmissions = submissions.filter(
    (s) => s.status === "completed" && (selectedTest === "all" || s.testId === selectedTest)
  );

  // Calculate stats
  const scores = filteredSubmissions.map((s) =>
    s.maxMarks ? Math.round((s.marksObtained! / s.maxMarks) * 100) : 0
  );

  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
  const passCount = scores.filter((s) => s >= 50).length;
  const failCount = scores.filter((s) => s < 50).length;
  const passRate = scores.length > 0 ? Math.round((passCount / scores.length) * 100) : 0;

  // Distribution data
  const distributionData = [
    { range: "0-20", count: scores.filter((s) => s >= 0 && s < 20).length },
    { range: "20-40", count: scores.filter((s) => s >= 20 && s < 40).length },
    { range: "40-60", count: scores.filter((s) => s >= 40 && s < 60).length },
    { range: "60-80", count: scores.filter((s) => s >= 60 && s < 80).length },
    { range: "80-100", count: scores.filter((s) => s >= 80 && s <= 100).length },
  ];

  const pieData = [
    { name: "Pass", value: passCount },
    { name: "Fail", value: failCount },
  ];

  const COLORS = ["hsl(0, 0%, 15%)", "hsl(0, 0%, 75%)"];

  // Top scorers
  const topScorers = [...filteredSubmissions]
    .sort((a, b) => {
      const aPercent = a.maxMarks ? (a.marksObtained! / a.maxMarks) : 0;
      const bPercent = b.maxMarks ? (b.marksObtained! / b.maxMarks) : 0;
      return bPercent - aPercent;
    })
    .slice(0, 5);

  const stats = [
    {
      title: "Average Score",
      value: `${averageScore}%`,
      icon: Target,
      change: scores.length > 0 ? "Based on completed submissions" : "No data",
    },
    {
      title: "Highest Score",
      value: `${highestScore}%`,
      icon: TrendingUp,
      change: "Top performer",
    },
    {
      title: "Lowest Score",
      value: `${lowestScore}%`,
      icon: TrendingDown,
      change: "Needs improvement",
    },
    {
      title: "Pass Rate",
      value: `${passRate}%`,
      icon: Award,
      change: `${passCount} passed, ${failCount} failed`,
    },
  ];

  return (
    <DashboardLayout
      title="Analytics"
      description="View detailed performance analytics and insights."
    >
      {/* Filter */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedTest} onValueChange={setSelectedTest}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select test" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tests</SelectItem>
              {tests.map((test) => (
                <SelectItem key={test.id} value={test.id}>
                  {test.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredSubmissions.length} completed submissions
          </span>
        </div>
      </div>

      {filteredSubmissions.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-secondary p-4">
              <BarChart3 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No analytics data yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Complete some exam grading to see performance analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 90%)" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: "hsl(0, 0%, 80%)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: "hsl(0, 0%, 80%)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(0, 0%, 100%)",
                          border: "2px solid hsl(0, 0%, 90%)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(0, 0%, 15%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pass/Fail Ratio */}
            <Card>
              <CardHeader>
                <CardTitle>Pass/Fail Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(0, 0%, 100%)",
                          border: "2px solid hsl(0, 0%, 90%)",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Scorers */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topScorers.map((submission, index) => {
                  const percentage = submission.maxMarks
                    ? Math.round((submission.marksObtained! / submission.maxMarks) * 100)
                    : 0;

                  return (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between rounded-lg border-2 border-border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{submission.studentName}</p>
                          <p className="text-sm text-muted-foreground">
                            {tests.find((t) => t.id === submission.testId)?.title || "Unknown Test"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{percentage}%</p>
                        <p className="text-sm text-muted-foreground">
                          {submission.marksObtained}/{submission.maxMarks}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {topScorers.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No completed submissions yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
