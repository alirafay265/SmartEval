import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  FileCheck,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: FileCheck,
    title: "AI-Powered Grading",
    description: "Automatically grade exams with advanced AI that understands context and nuance.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Process hundreds of submissions in minutes, not hours.",
  },
  {
    icon: Shield,
    title: "Accurate & Consistent",
    description: "Eliminate grading bias with standardized AI evaluation.",
  },
];

const benefits = [
  "Support for MCQ, Numeric, and Subjective questions",
  "OCR technology for handwritten submissions",
  "Detailed rubric-based grading",
  "Real-time analytics and insights",
  "Easy manual override and adjustments",
  "Export results in multiple formats",
];

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="border-b-2 border-border bg-surface-elevated">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">SmartEval AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")}>Get Started</Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b-2 border-border bg-surface-sunken">
          <div className="mx-auto max-w-7xl px-6 py-24 text-center">
            <div className="animate-slide-up">
              <span className="inline-flex items-center rounded-full border-2 border-border bg-background px-4 py-1.5 text-sm font-medium">
                <Zap className="mr-2 h-4 w-4" />
                AI-Powered Exam Grading Platform
              </span>
              <h1 className="mt-8 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Grade Exams
                <br />
                <span className="text-muted-foreground">10x Faster</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Transform your grading workflow with AI. Upload student submissions,
                let our intelligent system evaluate answers, and review results—all in one place.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="xl" onClick={() => navigate("/auth")}>
                  Start Grading Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" size="xl">
                  Watch Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-b-2 border-border py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to grade smarter
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Our platform combines cutting-edge AI with intuitive design to make
                exam grading effortless.
              </p>
            </div>

            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-2 transition-all hover:shadow-card-hover"
                >
                  <CardContent className="p-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                      <feature.icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-b-2 border-border bg-surface-sunken py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Built for educators,
                  <br />
                  by educators
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  We understand the challenges of grading. That's why we built a tool
                  that saves time while maintaining the highest standards of accuracy.
                </p>

                <ul className="mt-8 space-y-4">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <Button size="lg" className="mt-8" onClick={() => navigate("/auth")}>
                  Get Started Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="relative">
                <Card className="border-2 p-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                      <span className="font-medium">Total Submissions</span>
                      <span className="text-2xl font-bold">1,247</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                      <span className="font-medium">Graded Today</span>
                      <span className="text-2xl font-bold">324</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                      <span className="font-medium">Average Score</span>
                      <span className="text-2xl font-bold">78%</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border-2 border-foreground bg-primary p-4 text-primary-foreground">
                      <span className="font-medium">Time Saved</span>
                      <span className="text-2xl font-bold">127 hrs</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to transform your grading workflow?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Join thousands of educators who have already made the switch to AI-powered grading.
            </p>
            <Button size="xl" className="mt-8" onClick={() => navigate("/auth")}>
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-border bg-surface-elevated py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">SmartEval AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 SmartEval AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
