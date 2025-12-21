import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isToday, isPast, isTomorrow } from "date-fns";
import { Plus, CalendarIcon, CheckCircle2, Clock, AlertCircle, Ban, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { hasRankAtLeast, canAssignTo } from "@/lib/rbac";
import { TaskDetailView } from "@/components/TaskDetailView";

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
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'my-tasks' | 'all-tasks' | 'due-today' | 'overdue'>('my-tasks');
  const [showCompleted, setShowCompleted] = useState(false);

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
      setCanCreateTasks(hasRankAtLeast(profile.role, 1));
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
      if (!hasRankAtLeast(currentUserProfile?.role, 1)) {
        toast.error("Only Committee and above can create tasks");
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

  const handleAssignTask = async (taskId: string) => {
    try {
      setLoading(true);
      if (!hasRankAtLeast(currentUserProfile?.role, 1)) {
        toast.error("Only Committee and above can assign tasks");
        return;
      }

      // Validate input
      const validatedData = assignmentSchema.parse({
        assignee_id: assigneeId,
        due_date: dueDate,
        notes: assignmentNotes || undefined,
      });

      // Get assignee's user_id from profile
      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', validatedData.assignee_id)
        .single();

      if (!assigneeProfile) {
        toast.error("Invalid assignee selected");
        return;
      }

      const { error } = await supabase.rpc("assign_or_reassign_task", {
        p_task_id: taskId,
        p_assignee_user_id: assigneeProfile.user_id,
      });

      if (error) throw error;

      toast.success("Task assigned successfully!");
      setAssignDialogOpen(false);
      resetAssignmentForm();
      fetchMyAssignments();
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
      // Check authorization - only assignee can update status
      const assignment = myAssignments.find(a => a.id === assignmentId);
      if (!assignment || assignment.assignee_id !== currentUserProfile?.id) {
        toast.error("You can only update your own task status");
        return;
      }

      // Optimistic update
      setMyAssignments(prev => 
        prev.map(assignment => 
          assignment.id === assignmentId 
            ? { ...assignment, status: newStatus }
            : assignment
        )
      );

      const { error } = await supabase
        .from('task_assignments')
        .update({ status: newStatus as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' })
        .eq('id', assignmentId);

      if (error) {
        // Revert optimistic update on error
        fetchMyAssignments();
        throw error;
      }

      toast.success("Task status updated!");
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
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'MEDIUM': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'LOW': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'PENDING': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4 text-blue-400" />;
      case 'PENDING': return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return `Overdue (${format(date, 'MMM d')})`;
    return format(date, 'MMM d');
  };

  const getFilteredTasks = () => {
    let tasks: TaskAssignment[] = [];
    
    switch (activeFilter) {
      case 'my-tasks':
        tasks = myAssignments;
        break;
      case 'due-today':
        tasks = myAssignments.filter(t => t.due_date && isToday(new Date(t.due_date)));
        break;
      case 'overdue':
        tasks = myAssignments.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'COMPLETED');
        break;
      default:
        tasks = myAssignments;
    }
    
    if (!showCompleted) {
      tasks = tasks.filter(t => t.status !== 'COMPLETED');
    }
    
    return tasks.sort((a, b) => {
      // Priority sort: HIGH > MEDIUM > LOW
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const aPriority = priorityOrder[a.tasks.priority as keyof typeof priorityOrder] || 1;
      const bPriority = priorityOrder[b.tasks.priority as keyof typeof priorityOrder] || 1;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Then by due date
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      
      return 0;
    });
  };

  // Check if user has any access to tasks (rank >= 1)
  const hasTasksAccess = currentUserProfile && hasRankAtLeast(currentUserProfile.role, 1);

  if (!hasTasksAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 bg-black text-white">
        <div className="text-center space-y-4">
          <Ban className="h-16 w-16 mx-auto text-red-500 opacity-50" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            You don't have permission to access the Tasks page. This feature requires Committee level access or above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Sticky Header with Quick Filters */}
        <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-zinc-800 -mx-4 px-4 py-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant={activeFilter === 'my-tasks' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter('my-tasks')}
                className={cn(
                  "min-h-[36px] text-sm font-medium transition-all",
                  activeFilter === 'my-tasks' 
                    ? "bg-primary text-white" 
                    : "text-gray-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                My Tasks ({myAssignments.filter(t => !showCompleted ? t.status !== 'COMPLETED' : true).length})
              </Button>
              <Button
                variant={activeFilter === 'due-today' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter('due-today')}
                className={cn(
                  "min-h-[36px] text-sm font-medium transition-all",
                  activeFilter === 'due-today' 
                    ? "bg-primary text-white" 
                    : "text-gray-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                Due Today ({myAssignments.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'COMPLETED').length})
              </Button>
              <Button
                variant={activeFilter === 'overdue' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter('overdue')}
                className={cn(
                  "min-h-[36px] text-sm font-medium transition-all",
                  activeFilter === 'overdue' 
                    ? "bg-red-600 text-white hover:bg-red-700" 
                    : "text-gray-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                Overdue ({myAssignments.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'COMPLETED').length})
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-completed"
                  checked={showCompleted}
                  onCheckedChange={setShowCompleted}
                  className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="show-completed" className="text-sm text-gray-400 cursor-pointer">
                  Show completed
                </Label>
              </div>
              {canCreateTasks && (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 bg-primary text-white hover:bg-primary/90 min-h-[36px]">
                      <Plus className="h-4 w-4" />
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">Create New Task</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Create a new task that can be assigned to team members
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-title" className="text-gray-300">Title *</Label>
                        <Input
                          id="task-title"
                          placeholder="Task title"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          maxLength={200}
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-description" className="text-gray-300">Description</Label>
                        <Textarea
                          id="task-description"
                          placeholder="Task description"
                          value={taskDescription}
                          onChange={(e) => setTaskDescription(e.target.value)}
                          maxLength={1000}
                          rows={4}
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-priority" className="text-gray-300">Priority</Label>
                        <Select value={taskPriority} onValueChange={setTaskPriority}>
                          <SelectTrigger id="task-priority" className="bg-zinc-800 border-zinc-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="LOW" className="text-white focus:bg-zinc-800">Low</SelectItem>
                            <SelectItem value="MEDIUM" className="text-white focus:bg-zinc-800">Medium</SelectItem>
                            <SelectItem value="HIGH" className="text-white focus:bg-zinc-800">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateTask} className="w-full bg-primary text-white hover:bg-primary/90" disabled={loading}>
                        {loading ? "Creating..." : "Create Task"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* Task List - Compact Row Layout */}
        <div className="space-y-2">
          {getFilteredTasks().length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No tasks found</p>
              <p className="text-sm">
                {activeFilter === 'my-tasks' && 'No tasks assigned to you yet'}
                {activeFilter === 'due-today' && 'No tasks due today'}
                {activeFilter === 'overdue' && 'No overdue tasks'}
              </p>
            </div>
          ) : (
            getFilteredTasks().map((assignment) => {
              const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
              const isOverdue = dueDate && isPast(dueDate) && assignment.status !== 'COMPLETED';
              const isDueToday = dueDate && isToday(dueDate);
              
              return (
                <div
                  key={assignment.id}
                  className={cn(
                    "group flex items-center gap-4 p-4 rounded-lg border transition-all hover:border-zinc-600",
                    assignment.status === 'COMPLETED' 
                      ? "bg-zinc-900/50 border-zinc-800 opacity-75" 
                      : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50",
                    isOverdue && "border-red-500/30 bg-red-950/10",
                    isDueToday && assignment.status !== 'COMPLETED' && "border-orange-500/30 bg-orange-950/10"
                  )}
                >
                  {/* Completion Checkbox */}
                  <Checkbox
                    checked={assignment.status === 'COMPLETED'}
                    onCheckedChange={(checked) => {
                      handleUpdateTaskStatus(
                        assignment.id, 
                        checked ? 'COMPLETED' : 'PENDING'
                      );
                    }}
                    className="border-zinc-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-medium text-white truncate text-sm",
                          assignment.status === 'COMPLETED' && "line-through text-gray-500"
                        )}>
                          {assignment.tasks.title}
                        </h3>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {assignment.profiles?.title || assignment.profiles?.ecell_id || 'Unassigned'}
                        </div>
                      </div>

                      {/* Badges and Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Priority Badge */}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs border",
                            getPriorityColor(assignment.tasks.priority)
                          )}
                        >
                          {assignment.tasks.priority}
                        </Badge>

                        {/* Due Date */}
                        {dueDate && (
                          <div className={cn(
                            "text-xs px-2 py-1 rounded border",
                            isOverdue 
                              ? "bg-red-500/10 text-red-400 border-red-500/20" 
                              : isDueToday 
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          )}>
                            {formatDueDate(assignment.due_date)}
                          </div>
                        )}

                        {/* View Details Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedAssignmentId(assignment.id);
                            setDetailViewOpen(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white hover:bg-zinc-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Status Dropdown - Shows on Hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Select
                            value={assignment.status}
                            onValueChange={(value) => handleUpdateTaskStatus(assignment.id, value)}
                          >
                            <SelectTrigger className="w-[120px] h-8 bg-zinc-800 border-zinc-700 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                              <SelectItem value="PENDING" className="text-white focus:bg-zinc-800 text-xs">Pending</SelectItem>
                              <SelectItem value="IN_PROGRESS" className="text-white focus:bg-zinc-800 text-xs">In Progress</SelectItem>
                              <SelectItem value="COMPLETED" className="text-white focus:bg-zinc-800 text-xs">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Management Section for Admins */}
        {canCreateTasks && (
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-6">Task Management</h2>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">All Tasks</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage and assign tasks to team members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allTasks.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No tasks created yet</p>
                ) : (
                  <div className="space-y-3">
                    {allTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-zinc-700">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{task.title}</h4>
                          <p className="text-sm text-gray-400 mt-1">
                            {task.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPriorityColor(task.priority))}
                          >
                            {task.priority}
                          </Badge>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary hover:text-white"
                                onClick={() => resetAssignmentForm()}
                              >
                                Assign
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                              <DialogHeader>
                                <DialogTitle className="text-white">Assign Task</DialogTitle>
                                <DialogDescription className="text-gray-400">
                                  Assign "{task.title}" to a team member
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="assignee" className="text-gray-300">Assignee *</Label>
                                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                      <SelectValue placeholder="Select a member" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                      {(currentUserProfile ? profiles.filter((p) => p.id !== currentUserProfile.id) : profiles).map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id} className="text-white focus:bg-zinc-800">
                                          {profile.ecell_id || 'No ID'} - {profile.title || profile.role}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-gray-300">Due Date</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-start text-left font-normal bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700",
                                          !dueDate && "text-gray-500"
                                        )}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800">
                                      <Calendar
                                        mode="single"
                                        selected={dueDate}
                                        onSelect={setDueDate}
                                        initialFocus
                                        className="bg-zinc-900 text-white"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="assignment-notes" className="text-gray-300">Notes</Label>
                                  <Textarea
                                    id="assignment-notes"
                                    placeholder="Additional notes for the assignee"
                                    value={assignmentNotes}
                                    onChange={(e) => setAssignmentNotes(e.target.value)}
                                    maxLength={500}
                                    rows={3}
                                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                                  />
                                </div>

                                <Button 
                                  onClick={() => handleAssignTask(task.id)} 
                                  className="w-full bg-primary text-white hover:bg-primary/90" 
                                  disabled={loading || !assigneeId}
                                >
                                  {loading ? "Assigning..." : "Assign Task"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Task Detail View */}
        <TaskDetailView
          assignmentId={selectedAssignmentId}
          open={detailViewOpen}
          onOpenChange={setDetailViewOpen}
          currentUserId={currentUserProfile?.id}
        />
      </div>
    </div>
  );
};

export default Tasks;
