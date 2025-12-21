import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, CheckCircle2, AlertCircle, UserPlus, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "task_created" | "task_assigned" | "status_changed" | "task_completed";
  task_title: string;
  actor_name: string;
  actor_photo: string | null;
  assignee_name?: string;
  old_status?: string;
  new_status?: string;
  timestamp: string;
}

export const TaskActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();

    const tasksChannel = supabase
      .channel("task-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchActivities)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignments" }, fetchActivities)
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, []);

  const fetchActivities = async () => {
    try {
      const [tasksResult, assignmentsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select(`
            id,
            title,
            status,
            created_at,
            profiles:created_by (ecell_id, title, photo_url)
          `)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("task_assignments")
          .select(`
            id,
            status,
            created_at,
            updated_at,
            tasks (id, title),
            assignee:profiles!task_assignments_assignee_id_fkey (ecell_id, title, photo_url),
            assigner:profiles!task_assignments_assigned_by_fkey (ecell_id, title, photo_url)
          `)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const activities: ActivityItem[] = [];

      if (tasksResult.data) {
        tasksResult.data.forEach((task) => {
          activities.push({
            id: `task-${task.id}`,
            type: "task_created",
            task_title: task.title,
            actor_name: task.profiles?.title || task.profiles?.ecell_id || "Unknown",
            actor_photo: task.profiles?.photo_url,
            timestamp: task.created_at,
          });
        });
      }

      if (assignmentsResult.data) {
        assignmentsResult.data.forEach((assignment) => {
          activities.push({
            id: `assignment-${assignment.id}`,
            type: "task_assigned",
            task_title: assignment.tasks?.title || "Unknown Task",
            actor_name: assignment.assigner?.title || assignment.assigner?.ecell_id || "Unknown",
            actor_photo: assignment.assigner?.photo_url,
            assignee_name: assignment.assignee?.title || assignment.assignee?.ecell_id || "Unknown",
            timestamp: assignment.created_at,
          });

          if (assignment.status === "COMPLETED") {
            activities.push({
              id: `completed-${assignment.id}`,
              type: "task_completed",
              task_title: assignment.tasks?.title || "Unknown Task",
              actor_name: assignment.assignee?.title || assignment.assignee?.ecell_id || "Unknown",
              actor_photo: assignment.assignee?.photo_url,
              timestamp: assignment.updated_at,
            });
          }
        });
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(activities.slice(0, 20));
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "task_created":
        return <Plus className="h-4 w-4 text-primary" />;
      case "task_assigned":
        return <UserPlus className="h-4 w-4 text-blue-400" />;
      case "status_changed":
        return <Clock className="h-4 w-4 text-orange-400" />;
      case "task_completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getActivityMessage = (activity: ActivityItem) => {
    switch (activity.type) {
      case "task_created":
        return (
          <>
            <span className="font-medium">{activity.actor_name}</span> created task{" "}
            <span className="font-medium">{activity.task_title}</span>
          </>
        );
      case "task_assigned":
        return (
          <>
            <span className="font-medium">{activity.actor_name}</span> assigned{" "}
            <span className="font-medium">{activity.task_title}</span> to{" "}
            <span className="font-medium">{activity.assignee_name}</span>
          </>
        );
      case "task_completed":
        return (
          <>
            <span className="font-medium">{activity.actor_name}</span> completed{" "}
            <span className="font-medium">{activity.task_title}</span>
          </>
        );
      case "status_changed":
        return (
          <>
            <span className="font-medium">{activity.actor_name}</span> changed status of{" "}
            <span className="font-medium">{activity.task_title}</span> from{" "}
            <Badge variant="outline" className="text-xs">
              {activity.old_status}
            </Badge>{" "}
            to{" "}
            <Badge variant="outline" className="text-xs">
              {activity.new_status}
            </Badge>
          </>
        );
      default:
        return "Unknown activity";
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription className="text-gray-400">Real-time task updates and changes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading activities...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recent activity</div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 mt-1">{getActivityIcon(activity.type)}</div>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={activity.actor_photo || ""} />
                    <AvatarFallback className="text-xs bg-zinc-800 text-gray-300">
                      {activity.actor_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">{getActivityMessage(activity)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
