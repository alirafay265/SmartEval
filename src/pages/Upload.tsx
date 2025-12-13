import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Upload as UploadIcon, X, CheckCircle2, FileText, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTests, useStudentLists, useSubmissions, uploadToStorage } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [selectedStudentList, setSelectedStudentList] = useState("");
  const [rubricCriteria, setRubricCriteria] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [bulkUploadStudents, setBulkUploadStudents] = useState<Array<{student: Student, file: File | null}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const { user, session } = useAuth();
  const { tests, loading: testsLoading } = useTests();
  const { studentLists, loading: listsLoading } = useStudentLists();
  const { addSubmission } = useSubmissions();

  const allStudents = studentLists.flatMap((list) => list.students || []);

  // Populate bulk upload students when student list is selected
  useEffect(() => {
    if (selectedStudentList) {
      const studentList = studentLists.find(list => list.id === selectedStudentList);
      if (studentList?.students) {
        setBulkUploadStudents(studentList.students.map(student => ({
          student,
          file: null
        })));
      }
    } else {
      setBulkUploadStudents([]);
    }
  }, [selectedStudentList, studentLists]);

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
      newFiles.forEach((_, index) => {
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
              }
            }
            return updated;
          });
        }, 200);
      });
    },
    [selectedStudent, allStudents, uploadedFiles.length]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".pdf") || fileName.endsWith(".docx")) return FileText;
    return Image;
  };

  const handleUploadAll = async () => {
    if (!selectedStudent && !selectedStudentList && uploadedFiles.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a student, student list, or upload files with student names.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTest && !rubricCriteria) {
      toast({
        title: "Missing Grading Criteria",
        description: "Please either select a test or provide rubric criteria for grading.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to upload",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      for (const uploadFile of uploadedFiles.filter(f => f.status === "completed")) {
        // First, upload file to storage
        const filePath = `${user.id}/submissions/${selectedTest}/${Date.now()}-${uploadFile.file.name}`;
        const fileUrl = await uploadToStorage('exam-uploads', filePath, uploadFile.file);
        
        // Process file through backend to extract content
        let extractedContent = null;
        let extractedQuestions = null;
        
        try {
          console.log('🔄 Processing file through backend:', uploadFile.file.name);
          console.log('📧 User session:', session?.user?.email);
          console.log('🔑 Token available:', !!session?.access_token);
          
          const formData = new FormData();
          formData.append('file', uploadFile.file);
          
          const response = await fetch('/api/v1/files/process-exam', {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
            },
          });
          
          console.log('📡 Backend response status:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            console.log('📄 Backend result:', result);
            if (result.success) {
              extractedContent = result.data.extracted_text;
              extractedQuestions = result.data.parsed_questions;
              console.log('✅ Extracted content length:', extractedContent?.length || 0);
              console.log('✅ Extracted questions count:', extractedQuestions?.length || 0);
            } else {
              console.warn('❌ Backend processing failed:', result.message);
            }
          } else {
            console.error('❌ Backend response not OK:', response.status, response.statusText);
          }
        } catch (processError) {
          console.warn('File processing failed, storing without content:', processError);
        }
        
        // Create submission with extracted content
        console.log('💾 Creating submission with data:', {
          student_id: selectedStudent || null,
          student_name: uploadFile.studentName || uploadFile.file.name.replace(/\.[^/.]+$/, ""),
          test_id: selectedTest,
          file_url: fileUrl,
          file_name: uploadFile.file.name,
          content: extractedContent ? `${extractedContent.length} chars` : 'null',
          extracted_questions: extractedQuestions ? `${extractedQuestions.length} questions` : 'null',
          status: "ungraded",
        });
        
        const submissionResult = await addSubmission({
          student_id: selectedStudent || null,
          student_name: uploadFile.studentName || uploadFile.file.name.replace(/\.[^/.]+$/, ""),
          test_id: selectedTest || null,
          file_url: fileUrl,
          file_name: uploadFile.file.name,
          content: extractedContent,
          extracted_questions: extractedQuestions,
          rubric_criteria: rubricCriteria || null,
          status: "ungraded",
          processed_at: extractedContent ? new Date().toISOString() : null,
        });
        
        console.log('💾 Submission result:', submissionResult);

        // Automatically grade the submission if we have content and grading criteria
        if (submissionResult && extractedContent && (selectedTest || rubricCriteria)) {
          console.log('🎯 Starting automatic grading for submission:', submissionResult.id);
          
          try {
            const gradingResponse = await fetch('/api/v1/files/grade-exam', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                submission_id: submissionResult.id,
                questions: extractedQuestions,
                rubric_criteria: rubricCriteria || undefined,
              }),
            });

            if (gradingResponse.ok) {
              const gradingResult = await gradingResponse.json();
              console.log('✅ Automatic grading completed:', gradingResult);
              
              // Update submission status to completed
              // The backend should handle this, but we can also update locally
              
            } else {
              console.warn('⚠️ Automatic grading failed:', gradingResponse.status);
              // Keep status as "ready_for_grading" so user can manually grade later
            }
          } catch (gradingError) {
            console.warn('⚠️ Automatic grading error:', gradingError);
            // Keep status as "ready_for_grading" so user can manually grade later
          }
        }
      }

      toast({
        title: "Upload complete!",
        description: `${uploadedFiles.length} files uploaded and processed successfully`,
      });

      setUploadedFiles([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpload = async () => {
    const filesToUpload = bulkUploadStudents.filter(item => item.file);
    
    if (filesToUpload.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select files for at least one student.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTest && !rubricCriteria) {
      toast({
        title: "Missing Grading Criteria",
        description: "Please either select a test or provide rubric criteria for grading.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      for (const { student, file } of filesToUpload) {
        if (!file) continue;

        // Upload file to storage
        const filePath = `${user?.id}/submissions/${selectedTest || 'rubric'}-${Date.now()}-${file.name}`;
        const fileUrl = await uploadToStorage('exam-uploads', filePath, file);

        // Process file through backend if needed
        let extractedContent = null;
        let extractedQuestions = null;

        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch('/api/v1/files/process-exam', {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
            },
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              extractedContent = result.data.extracted_text;
              extractedQuestions = result.data.parsed_questions;
            }
          }
        } catch (processError) {
          console.warn('File processing failed for', student.name, processError);
        }

        // Create submission
        const bulkSubmissionResult = await addSubmission({
          student_id: student.id,
          student_name: student.name,
          test_id: selectedTest || null,
          file_url: fileUrl,
          file_name: file.name,
          content: extractedContent,
          extracted_questions: extractedQuestions,
          rubric_criteria: rubricCriteria || null,
          status: extractedContent ? "processing" : "pending",
          processed_at: extractedContent ? new Date().toISOString() : null,
        });

        // Automatically grade the submission if we have content and grading criteria
        if (bulkSubmissionResult && extractedContent && (selectedTest || rubricCriteria)) {
          try {
            const gradingResponse = await fetch('/api/v1/files/grade-exam', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                submission_id: bulkSubmissionResult.id,
                questions: extractedQuestions,
                rubric_criteria: rubricCriteria || undefined,
              }),
            });

            if (gradingResponse.ok) {
              console.log('✅ Automatic grading completed for:', student.name);
            } else {
              console.warn('⚠️ Automatic grading failed for:', student.name);
            }
          } catch (gradingError) {
            console.warn('⚠️ Automatic grading error for', student.name, ':', gradingError);
          }
        }
      }

      toast({
        title: "Bulk Upload Complete!",
        description: `${filesToUpload.length} files uploaded successfully.`,
      });

      // Reset state
      setBulkUploadStudents(prev => prev.map(item => ({ ...item, file: null })));
      setSelectedStudentList("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload some files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const loading = testsLoading || listsLoading;

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
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(tests.map((t) => t.course_name))].map((course) => (
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Test (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedTest || "none"} onValueChange={(val) => setSelectedTest(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific test</SelectItem>
                    {tests
                      .filter((t) => !selectedCourse || t.course_name === selectedCourse)
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Rubric Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Enter grading criteria (required if no test selected)..."
                value={rubricCriteria}
                onChange={(e) => setRubricCriteria(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-2">
                This will be sent to the AI for grading if no specific test is selected.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Student Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Individual Student</label>
                    <Select value={selectedStudent || "all"} onValueChange={(val) => {
                      setSelectedStudent(val === "all" ? "" : val);
                      if (val !== "all" && val !== "") setSelectedStudentList("");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select individual student" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        {allStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.roll_no})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    — OR —
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Student List</label>
                    <Select value={selectedStudentList || "none"} onValueChange={(val) => {
                      const actualVal = val === "none" ? "" : val;
                      setSelectedStudentList(actualVal);
                      if (actualVal) setSelectedStudent("");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select student list for bulk upload" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No student list</SelectItem>
                        {studentLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.students?.length || 0} students)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
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
                  or click to browse • PDF, DOCX, PNG, JPG supported
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
              <Button onClick={handleUploadAll} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Process All"}
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

        {/* Bulk Upload for Student List */}
        {selectedStudentList && bulkUploadStudents.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bulk Upload for Student List</CardTitle>
              <Button onClick={handleBulkUpload} disabled={isProcessing}>
                {isProcessing ? "Uploading..." : "Upload All"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bulkUploadStudents.map((item, index) => (
                  <div
                    key={item.student.id}
                    className="flex items-center gap-4 rounded-lg border-2 border-border p-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.student.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Roll No: {item.student.roll_no}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBulkUploadStudents(prev => 
                              prev.map((student, i) => 
                                i === index ? { ...student, file } : student
                              )
                            );
                          }
                        }}
                        className="hidden"
                        id={`file-${item.student.id}`}
                      />
                      <label
                        htmlFor={`file-${item.student.id}`}
                        className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                      >
                        {item.file ? "Change File" : "Select File"}
                      </label>
                      {item.file && (
                        <span className="text-sm text-muted-foreground">
                          {item.file.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
