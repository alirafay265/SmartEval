import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, Upload, Trash2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStudentLists } from "@/hooks/useSupabaseData";
import { Skeleton } from "@/components/ui/skeleton";

interface StudentInput {
  name: string;
  roll_no: string;
  email: string;
}

export default function Students() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [students, setStudents] = useState<StudentInput[]>([{ name: "", roll_no: "", email: "" }]);

  const { toast } = useToast();
  const { studentLists, loading, addStudentList } = useStudentLists();

  const addStudentField = () => {
    setStudents([...students, { name: "", roll_no: "", email: "" }]);
  };

  const updateStudent = (index: number, field: keyof StudentInput, value: string) => {
    const updated = [...students];
    updated[index] = { ...updated[index], [field]: value };
    setStudents(updated);
  };

  const removeStudent = (index: number) => {
    if (students.length > 1) {
      setStudents(students.filter((_, i) => i !== index));
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      
      const dataLines = lines[0].includes("name") || lines[0].includes("Name") 
        ? lines.slice(1) 
        : lines;

      const parsed = dataLines.map((line) => {
        const [name, roll_no, email] = line.split(",").map((s) => s.trim());
        return { name: name || "", roll_no: roll_no || "", email: email || "" };
      }).filter(s => s.name || s.roll_no || s.email);

      if (parsed.length > 0) {
        setStudents(parsed);
        toast({
          title: "CSV imported",
          description: `${parsed.length} students loaded from file`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!listName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a list name",
        variant: "destructive",
      });
      return;
    }

    const validStudents = students.filter((s) => s.name && s.roll_no);
    if (validStudents.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one student with name and roll number",
        variant: "destructive",
      });
      return;
    }

    const result = await addStudentList(listName, validStudents);
    
    if (result) {
      toast({
        title: "Student list created!",
        description: `"${listName}" with ${validStudents.length} students`,
      });

      setIsDialogOpen(false);
      setListName("");
      setStudents([{ name: "", roll_no: "", email: "" }]);
    }
  };

  return (
    <DashboardLayout
      title="Student Lists"
      description="Create and manage student lists for your courses."
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {loading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              `${studentLists.length} student list${studentLists.length !== 1 ? "s" : ""}`
            )}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New List
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Student List</DialogTitle>
              <DialogDescription>
                Add students manually or import from a CSV file.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="listName">List Name</Label>
                <Input
                  id="listName"
                  placeholder="e.g., Fall 2024 - Section A"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-medium">Students</h3>
                <div className="flex gap-2">
                  <label htmlFor="csv-upload">
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleCSVUpload}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV
                      </span>
                    </Button>
                  </label>
                  <Button variant="outline" size="sm" onClick={addStudentField}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Row
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border-2 border-border p-4">
                <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 text-sm font-medium text-muted-foreground">
                  <span>Name</span>
                  <span>Roll No.</span>
                  <span>Email</span>
                  <span></span>
                </div>

                {students.map((student, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-3">
                    <Input
                      placeholder="John Doe"
                      value={student.name}
                      onChange={(e) => updateStudent(index, "name", e.target.value)}
                    />
                    <Input
                      placeholder="2024001"
                      value={student.roll_no}
                      onChange={(e) => updateStudent(index, "roll_no", e.target.value)}
                    />
                    <Input
                      placeholder="john@example.com"
                      type="email"
                      value={student.email}
                      onChange={(e) => updateStudent(index, "email", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStudent(index)}
                      disabled={students.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                CSV format: name, roll_number, email (one student per line)
              </p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Create List
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Student Lists Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : studentLists.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-secondary p-4">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No student lists yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Create a student list to organize your students and upload their exam submissions.
            </p>
            <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studentLists.map((list) => (
            <Card key={list.id} className="hover:shadow-card-hover transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{list.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {list.students?.length || 0} student{(list.students?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {list.students?.slice(0, 3).map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{student.name}</span>
                      <span className="text-muted-foreground">{student.roll_no}</span>
                    </div>
                  ))}
                  {(list.students?.length || 0) > 3 && (
                    <p className="text-center text-sm text-muted-foreground">
                      +{(list.students?.length || 0) - 3} more students
                    </p>
                  )}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Created {new Date(list.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
