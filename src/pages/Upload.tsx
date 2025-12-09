import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload as UploadIcon, File, X, CheckCircle2, FileText, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppStore, Submission } from "@/lib/store";

interface UploadedFile {
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  studentName?: string;
}

export default function Upload() {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedTest, setSelectedTest] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const { toast } = useToast();
  const { tests, studentLists, addSubmission } = useAppStore();

  const allStudents = studentLists.flatMap((list) => list.students);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "uploading" as const,
        studentName: selectedStudent
          ? allStudents.find((s) => s.id === selectedStudent)?.name
          : undefined,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Simulate upload progress
      newFiles.forEach((uploadFile, index) => {
        const fileIndex = uploadedFiles.length + index;
        const interval = setInterval(() => {
          setUploadedFiles((prev) => {
            const updated = [...prev];
            const currentFile = updated[fileIndex];
            if (currentFile && currentFile.progress < 100) {
              currentFile.progress = Math.min(currentFile.progress + 10, 100);
              if (currentFile.progress === 100) {
                currentFile.status = "completed";
                clearInterval(interval);

                // Add to store
                const submission: Submission = {
                  id: crypto.randomUUID(),
                  studentId: selectedStudent || crypto.randomUUID(),
                  studentName:
                    currentFile.studentName ||
                    currentFile.file.name.replace(/\.[^/.]+$/, ""),
                  testId: selectedTest,
                  fileUrl: URL.createObjectURL(currentFile.file),
                  fileName: currentFile.file.name,
                  status: "pending",
                  uploadedAt: new Date().toISOString(),
                };
                addSubmission(submission);
              }
            }
            return updated;
          });
        }, 200);
      });
    },
    [selectedStudent, allStudents, uploadedFiles.length, selectedTest, addSubmission]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".pdf")) return FileText;
    return Image;
  };

  const handleUploadAll = () => {
    if (!selectedTest) {
      toast({
        title: "Error",
        description: "Please select a test first",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Upload complete!",
      description: `${uploadedFiles.length} files uploaded successfully`,
    });
  };

  return (
    <DashboardLayout
      title="Upload Exams"
      description="Upload student exam submissions for AI grading."
    >
      <div className="mx-auto max-w-4xl">
        {/* Selection Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Course</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(tests.map((t) => t.courseName))].map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                  {tests.length === 0 && (
                    <SelectItem value="none" disabled>
                      No courses available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Test</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTest} onValueChange={setSelectedTest}>
                <SelectTrigger>
                  <SelectValue placeholder="Select test" />
                </SelectTrigger>
                <SelectContent>
                  {tests
                    .filter((t) => !selectedCourse || t.courseName === selectedCourse)
                    .map((test) => (
                      <SelectItem key={test.id} value={test.id}>
                        {test.title}
                      </SelectItem>
                    ))}
                  {tests.length === 0 && (
                    <SelectItem value="none" disabled>
                      No tests available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Student (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedStudent || "all"} onValueChange={(val) => setSelectedStudent(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {allStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} ({student.rollNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Upload Zone */}
        <Card className="mb-6">
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
                  <UploadIcon className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-medium">
                  {isDragActive ? "Drop files here" : "Drag & drop files here"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  or click to browse • PDF, PNG, JPG supported
                </p>
                <Button variant="outline" className="mt-4">
                  Browse Files
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle>
              <Button onClick={handleUploadAll}>
                Process All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedFiles.map((uploadFile, index) => {
                  const FileIcon = getFileIcon(uploadFile.file.name);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-4 rounded-lg border-2 border-border p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <FileIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="truncate font-medium">{uploadFile.file.name}</p>
                          <div className="ml-4 flex items-center gap-2">
                            {uploadFile.status === "completed" ? (
                              <CheckCircle2 className="h-5 w-5 text-foreground" />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {uploadFile.progress}%
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {uploadFile.studentName && (
                          <p className="text-sm text-muted-foreground">
                            Student: {uploadFile.studentName}
                          </p>
                        )}
                        {uploadFile.status === "uploading" && (
                          <Progress value={uploadFile.progress} className="mt-2 h-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
