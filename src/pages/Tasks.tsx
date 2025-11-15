import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskActivityFeed } from "@/components/TaskActivityFeed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Plus, CalendarIcon, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { hasAtLeast, canAssignTo } from "@/lib/rbac";

// Validation schemas
const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().trim().max(1000, "Description must be less than 1000 characters").optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

const assignmentSchema = z.object({
  assignee_id: z.string().uuid("Invalid assignee"),
  due_date: z.date().optional(),
  notes: z.string().trim().max(500, "Notes must be less than 500 characters").optional(),
});

interface Profile {
  id: string;
  user_id: string;
  ecell_id: string | null;
  title: string | null;
  role: string;
  department: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
}

interface TaskAssignment {
  id: string;
  task_id: string;
  assignee_id: string;
  assigned_by: string | null;
  due_date: string | null;
  status: string;
  notes: string | null;
  tasks: Task;
  profiles: Profile;
}

const Tasks = () => {
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [canCreateTasks, setCanCreateTasks] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myAssignments, setMyAssignments] = useState<TaskAssignment[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  // Form states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<string>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (currentUserProfile) {
      fetchMyAssignments();
      if (canCreateTasks) {
        fetchAllTasks();
      }
    }
  }, [currentUserProfile, canCreateTasks]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setCurrentUserProfile(profile);
      setCanCreateTasks(hasAtLeast(profile.role, "COMMITTEE"));
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('ecell_id');

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    setProfiles(data || []);
  };

  const fetchMyAssignments = async () => {
    if (!currentUserProfile) return;

    const { data, error } = await supabase
      .from('task_assignments')
      .select(`
        *,
        tasks (*),
        profiles!task_assignments_assignee_id_fkey (*)
      `)
      .eq('assignee_id', currentUserProfile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching assignments:', error);
      return;
    }

    setMyAssignments((data as TaskAssignment[]) || []);
  };

  const fetchAllTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    setAllTasks(data || []);
  };

  const handleCreateTask = async () => {
    try {
      setLoading(true);
      if (!hasAtLeast(currentUserProfile?.role, "COMMITTEE")) {
        toast.error("Only Mentors and Committee can create tasks");
        return;
      }

      // Validate input
      const validatedData = taskSchema.parse({
        title: taskTitle,
        description: taskDescription || undefined,
        priority: taskPriority,
      });

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: validatedData.title,
          description: validatedData.description,
          priority: validatedData.priority,
          created_by: currentUserProfile?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Task created successfully!");
      setCreateDialogOpen(false);
      resetTaskForm();
      fetchAllTasks();
      } catch (err: unknown) {
        if (err instanceof z.ZodError) {
          toast.error(err.errors[0].message);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          toast.error(message || "Failed to create task");
        }
      } finally {
        setLoading(false);
      }
    };

  const handleAssignTask = async () => {
    try {
      setLoading(true);
      if (!hasAtLeast(currentUserProfile?.role, "COMMITTEE")) {
        toast.error("Only Mentors and Committee can assign tasks");
        return;
      }

      // Validate input
      const validatedData = assignmentSchema.parse({
        assignee_id: assigneeId,
        due_date: dueDate,
        notes: assignmentNotes || undefined,
      });

      const { error } = await supabase
        .from('task_assignments')
        .insert({
          task_id: selectedTaskId,
          assignee_id: validatedData.assignee_id,
          assigned_by: currentUserProfile?.id,
          due_date: validatedData.due_date?.toISOString(),
          notes: validatedData.notes,
        });

      if (error) throw error;

      toast.success("Task assigned successfully!");
      setAssignDialogOpen(false);
      resetAssignmentForm();
      fetchAllTasks();
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || "Failed to assign task");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({ status: newStatus as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success("Task status updated!");
      fetchMyAssignments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to update status");
    }
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskPriority("MEDIUM");
  };

  const resetAssignmentForm = () => {
    setAssigneeId("");
    setDueDate(undefined);
    setAssignmentNotes("");
    setSelectedTaskId("");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4 text-warning" />;
      case 'PENDING': return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  // Check if user has any access to tasks (only for specific roles)
  const hasTasksAccess = currentUserProfile && ["MENTOR", "COMMITTEE", "DEPT_HEAD"].includes(currentUserProfile.role);

  if (!hasTasksAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🚫</div>
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground max-w-md">
            You don't have permission to access the Tasks page. This feature is only available to Committee members, Mentors, and Department Heads.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {canCreateTasks && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-black border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all">
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Create a new task that can be assigned to team members
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Title *</Label>
                  <Input
                    id="task-title"
                    placeholder="Task title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    placeholder="Task description"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    maxLength={1000}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select value={taskPriority} onValueChange={setTaskPriority}>
                    <SelectTrigger id="task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateTask} className="w-full bg-black border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all" disabled={loading}>
                  {loading ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="my-tasks" className="w-full">
            <TabsList>
              <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
              {canCreateTasks && <TabsTrigger value="all-tasks">All Tasks</TabsTrigger>}
            </TabsList>

            <TabsContent value="my-tasks" className="space-y-4">
          {myAssignments.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No tasks assigned to you yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {assignment.tasks.title}
                          {getStatusIcon(assignment.status)}
                        </CardTitle>
                        <CardDescription>
                          {assignment.tasks.description || "No description"}
                        </CardDescription>
                      </div>
                      <Badge variant={getPriorityColor(assignment.tasks.priority)}>
                        {assignment.tasks.priority}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {assignment.due_date && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          Due: {format(new Date(assignment.due_date), "PPP")}
                        </div>
                      )}
                    </div>
                    {assignment.notes && (
                      <div className="text-sm">
                        <span className="font-medium">Notes: </span>
                        {assignment.notes}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Select
                        value={assignment.status}
                        onValueChange={(value) => handleUpdateTaskStatus(assignment.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {canCreateTasks && (
          <TabsContent value="all-tasks" className="space-y-4">
            {allTasks.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No tasks created yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {allTasks.map((task) => (
                  <Card key={task.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle>{task.title}</CardTitle>
                          <CardDescription>
                            {task.description || "No description"}
                          </CardDescription>
                        </div>
                        <Badge variant={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="border-primary text-primary hover:bg-primary hover:text-white transition-all"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setAssignDialogOpen(true);
                        }}
                      >
                        Assign Task
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <TaskActivityFeed />
        </div>
      </div>

      {/* Assign Task Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Assign this task to a team member with optional due date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee *</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {(currentUserProfile ? profiles.filter((p) => canAssignTo(currentUserProfile, p)) : profiles).map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.ecell_id || 'No ID'} - {profile.title || profile.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-notes">Notes</Label>
              <Textarea
                id="assignment-notes"
                placeholder="Additional notes for the assignee"
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            <Button onClick={handleAssignTask} className="w-full bg-black border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all" disabled={loading || !assigneeId}>
              {loading ? "Assigning..." : "Assign Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
