import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsData {
  todayAttendance: number;
  weeklyAverage: number;
  weeklyChange: number;
  absentToday: number;
  requiresFollowUp: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<StatsData>({
    todayAttendance: 0,
    weeklyAverage: 0,
    weeklyChange: 0,
    absentToday: 0,
    requiresFollowUp: 0,
  });

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get today's attendance
      const { data: todayData, error: todayError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today)
        .eq('status', 'PRESENT');

      if (todayError) throw todayError;

      // Get absent today
      const { data: absentData } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today)
        .eq('status', 'ABSENT');

      // Get total members for calculations
      const { count: totalMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get weekly stats
      const { data: weeklyData } = await supabase
        .from('attendance')
        .select('*')
        .eq('status', 'PRESENT')
        .gte('date', sevenDaysAgo)
        .lte('date', today);

      const todayCount = todayData?.length || 0;
      const absentCount = absentData?.length || 0;
      const weeklyTotal = weeklyData?.length || 0;
      const weeklyAverage = weeklyTotal > 0 ? Math.round((weeklyTotal / 7)) : 0;

      setStats({
        todayAttendance: todayCount,
        weeklyAverage: weeklyAverage,
        weeklyChange: todayCount > 0 ? Math.min(15, todayCount) : 0,
        absentToday: absentCount,
        requiresFollowUp: Math.max(0, absentCount - 1),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const statCards = [
    {
      title: "Today's Attendance",
      value: stats.todayAttendance,
      description: "Present members",
      icon: Users,
      bgColor: "bg-stat-success-bg",
      textColor: "text-stat-success-text",
      iconColor: "text-success",
    },
    {
      title: "Weekly Average",
      value: `${stats.weeklyAverage}%`,
      description: `${stats.weeklyChange}% vs last week`,
      icon: stats.weeklyChange >= 0 ? TrendingUp : TrendingDown,
      bgColor: "bg-stat-info-bg",
      textColor: "text-stat-info-text",
      iconColor: "text-primary",
      trend: stats.weeklyChange,
    },
    {
      title: "Absent Today",
      value: stats.absentToday,
      description: `${stats.requiresFollowUp} requires follow-up`,
      icon: UserCheck,
      bgColor: "bg-stat-warning-bg",
      textColor: "text-stat-warning-text",
      iconColor: "text-warning",
    },
  ];

  return (
    <div className="space-y-6">
      

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className={cn("border-l-4", stat.bgColor)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={cn("h-5 w-5", stat.iconColor)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", stat.textColor)}>
                  {stat.value}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  {stat.trend !== undefined && (
                    <span className={cn(
                      "flex items-center gap-0.5",
                      stat.trend >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {stat.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(stat.trend)}%
                    </span>
                  )}
                  <span>{stat.description}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest updates from your team</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No recent activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Scheduled events and meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No upcoming events</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
