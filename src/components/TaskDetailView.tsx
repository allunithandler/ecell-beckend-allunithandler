import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Calendar, User, Clock, CheckCircle2, AlertCircle, Plus, MessageSquare, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TaskEvent {
  id: string;
  task_id: string;
  event_type: 'TASK_CREATED' | 'TASK_ASSIGNED' | 'STATUS_CHANGED' | 'TASK_COMPLETED' | 'TASK_NOTE_ADDED';
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
  actor_user_id: string;
  profiles: {
    ecell_id: string | null;
    title: string | null;
    role: string | null;
    photo_url: string | null;
  } | null;
}

interface TaskAssignment {
  id: string;
  task_id: string;
  assignee_id: string;
  assigned_by: string | null;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    created_at: string;
    created_by: string | null;
  };
  assignee: {
    ecell_id: string | null;
    title: string | null;
    role: string | null;
    photo_url: string | null;
  };
  assigner: {
    ecell_id: string | null;
    title: string | null;
    role: string | null;
    photo_url: string | null;
  } | null;
  creator: {
    ecell_id: string | null;
    title: string | null;
    role: string | null;
    photo_url: string | null;
  } | null;
}

interface TaskDetailViewProps {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
}

export const TaskDetailView = ({ assignmentId, open, onOpenChange, currentUserId }: TaskDetailViewProps) => {
  const [assignment, setAssignment] = useState<TaskAssignment | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [addingUpdate, setAddingUpdate] = useState(false);

  useEffect(() => {
    if (assignmentId && open) {
      fetchTaskDetails();
    }
  }, [assignmentId, open]);

  const fetchTaskDetails = async () => {
    if (!assignmentId) return;
    
    setLoading(true);
    try {
      // Fetch assignment with related data
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('task_assignments')
        .select(`
          *,
          tasks (*),
          assignee:profiles!task_assignments_assignee_id_fkey (ecell_id, title, role, photo_url),
          assigner:profiles!task_assignments_assigned_by_fkey (ecell_id, title, role, photo_url)
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;

      // Fetch task creator
      if (assignmentData.tasks.created_by) {
        const { data: creatorData } = await supabase
          .from('profiles')
          .select('ecell_id, title, role, photo_url')
          .eq('id', assignmentData.tasks.created_by)
          .single();
        
        assignmentData.creator = creatorData;
      }

      setAssignment(assignmentData);

      // Fetch task events using task_id
      const { data: eventsData, error: eventsError } = await supabase
        .from('task_events')
        .select('*')
        .eq('task_id', assignmentData.task_id)
        .order('created_at', { ascending: true });

      if (eventsError) {
        console.warn('Task events not available:', eventsError);
        setEvents([]);
      } else {
        // Fetch profiles for event actors separately
        const actorUserIds = [...new Set(eventsData?.map(e => e.actor_user_id).filter(Boolean) || [])];
        const { data: actorsData } = await supabase
          .from('profiles')
          .select('user_id, ecell_id, title, role, photo_url')
          .in('user_id', actorUserIds);

        // Map profiles to events
        const eventsWithProfiles = eventsData?.map(event => ({
          ...event,
          profiles: actorsData?.find(p => p.user_id === event.actor_user_id) || null
        })) || [];

        setEvents(eventsWithProfiles);
      }

    } catch (error) {
      console.error('Error fetching task details:', error);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const addUpdate = async () => {
    if (!newUpdate.trim() || !assignment || !currentUserId) return;

    setAddingUpdate(true);
    try {
      const { error } = await supabase
        .from('task_events')
        .insert({
          task_id: assignment.task_id,
          event_type: 'TASK_NOTE_ADDED',
          notes: newUpdate.trim(),
          actor_user_id: currentUserId
        });

      if (error) throw error;

      setNewUpdate("");
      await fetchTaskDetails();
      toast.success("Update added successfully");
    } catch (error) {
      console.error('Error adding update:', error);
      toast.error('Failed to add update');
    } finally {
      setAddingUpdate(false);
    }
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

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'TASK_CREATED': return <Plus className="h-3 w-3 text-primary" />;
      case 'TASK_ASSIGNED': return <UserPlus className="h-3 w-3 text-blue-400" />;
      case 'STATUS_CHANGED': return <Clock className="h-3 w-3 text-orange-400" />;
      case 'TASK_COMPLETED': return <CheckCircle2 className="h-3 w-3 text-green-400" />;
      case 'TASK_NOTE_ADDED': return <MessageSquare className="h-3 w-3 text-purple-400" />;
      default: return <AlertCircle className="h-3 w-3 text-gray-400" />;
    }
  };

  const getEventLabel = (event: TaskEvent) => {
    const actorName = event.profiles?.title || event.profiles?.ecell_id || 'Unknown';
    
    switch (event.event_type) {
      case 'TASK_CREATED':
        return `Task created by ${actorName}`;
      case 'TASK_ASSIGNED':
        return `Assigned to ${assignment?.assignee?.title || assignment?.assignee?.ecell_id || 'Unknown'} by ${actorName}`;
      case 'STATUS_CHANGED':
        return `Status changed from ${event.old_value} to ${event.new_value} by ${actorName}`;
      case 'TASK_COMPLETED':
        return `Task completed by ${actorName}`;
      case 'TASK_NOTE_ADDED':
        return `Update added by ${actorName}`;
      default:
        return `Action by ${actorName}`;
    }
  };

  const formatPersonName = (person: any) => {
    return person?.title || person?.ecell_id || 'Unknown';
  };

  if (!assignment) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] bg-zinc-900 border-zinc-800">
          <div className="flex items-center justify-center h-64">
            {loading ? (
              <div className="text-gray-400">Loading task details...</div>
            ) : (
              <div className="text-gray-400">Task not found</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-zinc-900 border-zinc-800 p-0">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800">
          <DialogTitle className="text-white text-xl font-semibold">
            {assignment.tasks.title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Task details and activity timeline
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-120px)]">
          {/* ZONE 1: Task Summary */}
          <div className="lg:w-80 flex-shrink-0 p-6 border-r border-zinc-800 bg-zinc-950/50">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="outline" className={cn("text-xs font-medium", getPriorityColor(assignment.tasks.priority))}>
                  {assignment.tasks.priority}
                </Badge>
                <Badge variant="outline" className={cn("text-xs font-medium", getStatusColor(assignment.status))}>
                  {assignment.status.replace('_', ' ')}
                </Badge>
              </div>

              {assignment.tasks.description && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-sm text-gray-300">{assignment.tasks.description}</div>
                </div>
              )}

              {assignment.due_date && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Due Date</div>
                  <div className="text-sm text-gray-300 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 mb-1">Created By</div>
                <div className="text-sm text-gray-300">
                  {formatPersonName(assignment.creator)}
                  {assignment.creator?.role && (
                    <span className="text-xs text-gray-500 ml-1">({assignment.creator.role})</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Assigned To</div>
                <div className="text-sm text-gray-300">
                  {formatPersonName(assignment.assignee)}
                  {assignment.assignee?.role && (
                    <span className="text-xs text-gray-500 ml-1">({assignment.assignee.role})</span>
                  )}
                </div>
              </div>

              {assignment.assigner && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Assigned By</div>
                  <div className="text-sm text-gray-300">
                    {formatPersonName(assignment.assigner)}
                    {assignment.assigner?.role && (
                      <span className="text-xs text-gray-500 ml-1">({assignment.assigner.role})</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 mb-1">Created</div>
                <div className="text-sm text-gray-300">
                  {format(new Date(assignment.tasks.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              {assignment.notes && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Assignment Notes</div>
                  <div className="text-sm text-gray-300 bg-zinc-800/50 p-2 rounded text-xs">
                    {assignment.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ZONE 2: Activity Timeline */}
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-white">Activity Timeline</h3>
            </div>
            
            <ScrollArea className="flex-1 px-6">
              <div className="py-4 space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center mt-0.5">
                      {getEventIcon(event.event_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 font-medium">
                        {getEventLabel(event)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(event.created_at), 'MMM d, h:mm a')}
                      </div>
                      
                      {event.notes && (
                        <div className="mt-2 p-3 bg-zinc-800/30 rounded text-sm text-gray-300 border-l-2 border-zinc-700">
                          {event.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* ZONE 3: Add Update */}
            {currentUserId && (
              <div className="border-t border-zinc-800 p-6">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-white">Add Update</div>
                  <Textarea
                    placeholder="Add an update to this task..."
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 resize-none"
                    rows={3}
                  />
                  <Button
                    onClick={addUpdate}
                    disabled={!newUpdate.trim() || addingUpdate}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    {addingUpdate ? "Adding..." : "Add Update"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};