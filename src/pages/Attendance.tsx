import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Save, CheckSquare, Download, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  ecell_id: string | null;
  title: string | null;
  role: string;
  department: string | null;
  photo_url: string | null;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  session_type: "GENERAL" | "MEETING" | "WORKSHOP" | "EVENT";
  session_name?: string;
  location?: string;
  note: string | null;
  marked_by: string | null;
  created_at: string;
  profile?: Profile;
  marker?: Profile;
}

interface AttendanceSession {
  id: string;
  session_name: string;
  session_type: "GENERAL" | "MEETING" | "WORKSHOP" | "EVENT";
  session_date: string;
  location?: string;
  notes?: string;
  created_by: string;
}

const Attendance = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [sessionType, setSessionType] = useState<string>("GENERAL");
  const [sessionName, setSessionName] = useState<string>("");
  const [sessionLocation, setSessionLocation] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [canMarkAttendance, setCanMarkAttendance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [historySessionType, setHistorySessionType] = useState<string>("all");
  const [historyStatus, setHistoryStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("");

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);

  useEffect(() => {
    fetchCurrentUser();
    fetchProfiles();
    fetchAttendanceHistory();
    fetchSessions();

    const channel = supabase
      .channel("attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => {
        fetchAttendanceHistory();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_sessions" }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [startDate, endDate, historySessionType, historyStatus, searchQuery, memberFilter]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setCurrentUserProfile(profile);
        const canMark = profile.role === "MENTOR" || profile.role === "COMMITTEE" || profile.role === "DEPT_HEAD";
        setCanMarkAttendance(canMark);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("ecell_id");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      let query = supabase
        .from("attendance")
        .select(
          `
          *,
          profile:user_id(id, ecell_id, title, role, department, photo_url, user_id)
        `
        )
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (historySessionType !== "all") {
        query = query.eq("session_type", historySessionType as any);
      }

      if (historyStatus !== "all") {
        query = query.eq("status", historyStatus as any);
      }

      if (memberFilter) {
        query = query.eq("user_id", memberFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let records = (data || []).map((record: any) => ({
        ...record,
        profile: Array.isArray(record.profile) ? record.profile[0] : record.profile,
      }));

      if (searchQuery) {
        records = records.filter(
          (record: any) =>
            record.profile?.ecell_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.profile?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.session_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setAttendanceHistory(records as AttendanceRecord[]);
    } catch (error: any) {
      console.error("Error fetching attendance history:", error);
      toast.error("Failed to load attendance history");
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("*")
        .order("session_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };

  const handleMarkAllPresent = () => {
    const allowed = profiles;
    const allIds = new Set(allowed.map((p) => p.id));
    setSelectedMembers(allIds);
    toast.success("All members marked as present");
  };

  const handleSaveAttendance = async () => {
    if (!canMarkAttendance) {
      toast.error("You don't have permission to mark attendance");
      return;
    }

    if (selectedMembers.size === 0) {
      toast.error("Please select at least one member");
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const attendanceRecords = profiles
        .filter((p) => selectedMembers.has(p.id))
        .map((profile) => ({
          user_id: profile.id,
          date: dateStr,
          status: "PRESENT" as const,
          session_type: sessionType as any,
          session_name: sessionName || undefined,
          location: sessionLocation || undefined,
          marked_by: currentUserProfile!.id,
          created_by: currentUserProfile!.id,
        }));

      const { error } = await supabase.from("attendance").upsert(attendanceRecords, {
        onConflict: "user_id,date,session_type",
      });

      if (error) throw error;

      toast.success(`Attendance saved for ${selectedMembers.size} members!`);
      setSelectedMembers(new Set());
      setSessionName("");
      setSessionLocation("");
      fetchAttendanceHistory();
    } catch (error: any) {
      toast.error(error.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "E-Cell ID", "Name", "Department", "Status", "Session Type", "Session Name"];
    const rows = attendanceHistory.map((record) => [
      record.date,
      record.profile?.ecell_id || "N/A",
      record.profile?.title || "N/A",
      record.profile?.department || "N/A",
      record.status,
      record.session_type,
      record.session_name || "N/A",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Attendance exported successfully");
  };

  const getStatistics = () => {
    const total = attendanceHistory.length;
    const present = attendanceHistory.filter((r) => r.status === "PRESENT").length;
    const absent = attendanceHistory.filter((r) => r.status === "ABSENT").length;
    const late = attendanceHistory.filter((r) => r.status === "LATE").length;
    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

    return { total, present, absent, late, attendanceRate };
  };

  const stats = getStatistics();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user has any access to attendance (only for specific roles)
  const hasAttendanceAccess = currentUserProfile && ["MENTOR", "COMMITTEE", "DEPT_HEAD"].includes(currentUserProfile.role);

  if (!hasAttendanceAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access the attendance page.</p>
        </div>
        <Button onClick={() => window.history.back()} className="bg-primary text-white">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Attendance</h1>
          <p className="text-gray-400">Manage and track team attendance</p>
        </div>

        <Tabs defaultValue="mark" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="mark" className="data-[state=active]:bg-primary data-[state=active]:text-white text-gray-400">Mark Attendance</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white text-gray-400">History & Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="mark" className="space-y-4 mt-6">
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white">Mark Attendance</CardTitle>
                <CardDescription className="text-gray-400">Record attendance for team members</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(date, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={(d) => d && setDate(d)}
                          initialFocus
                          className="bg-zinc-900 text-white"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Session Type</Label>
                    <Select value={sessionType} onValueChange={setSessionType}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="GENERAL" className="text-white focus:bg-zinc-800">General</SelectItem>
                        <SelectItem value="MEETING" className="text-white focus:bg-zinc-800">Meeting</SelectItem>
                        <SelectItem value="WORKSHOP" className="text-white focus:bg-zinc-800">Workshop</SelectItem>
                        <SelectItem value="EVENT" className="text-white focus:bg-zinc-800">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Session Name (Optional)</Label>
                    <Input
                      placeholder="e.g., Monthly Meetup"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Location (Optional)</Label>
                    <Input
                      placeholder="e.g., Conference Room A"
                      value={sessionLocation}
                      onChange={(e) => setSessionLocation(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Members ({selectedMembers.size} selected)</Label>
                    <Button variant="outline" size="sm" onClick={handleMarkAllPresent} className="border-primary text-primary hover:bg-primary hover:text-white">
                      <CheckSquare className="h-4 w-4 mr-1" />
                      Mark All Present
                    </Button>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2 border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800 cursor-pointer transition-colors"
                        onClick={() => {
                          const newSelected = new Set(selectedMembers);
                          if (newSelected.has(profile.id)) {
                            newSelected.delete(profile.id);
                          } else {
                            newSelected.add(profile.id);
                          }
                          setSelectedMembers(newSelected);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.has(profile.id)}
                          onChange={() => { }}
                          className="rounded border-zinc-600 bg-zinc-800 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-white">{profile.title || profile.ecell_id || "Unknown"}</div>
                          <div className="text-xs text-gray-500">{profile.ecell_id || "No ID"}</div>
                        </div>
                        <Badge variant="outline" className="text-xs border-zinc-700 text-gray-400">
                          {profile.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSaveAttendance} disabled={saving || selectedMembers.size === 0} className="w-full bg-primary text-white hover:bg-primary/90">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Attendance ({selectedMembers.size})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-6">
            <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white">Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
                    <div className="text-sm text-gray-400">Total Records</div>
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
                    <div className="text-sm text-gray-400">Present</div>
                    <div className="text-2xl font-bold text-green-500">{stats.present}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
                    <div className="text-sm text-gray-400">Absent</div>
                    <div className="text-2xl font-bold text-red-500">{stats.absent}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
                    <div className="text-sm text-gray-400">Rate</div>
                    <div className="text-2xl font-bold text-primary">{stats.attendanceRate}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Attendance History</CardTitle>
                    <CardDescription className="text-gray-400">View past attendance records</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportToCSV} className="border-zinc-700 text-gray-300 hover:bg-zinc-800 hover:text-white">
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          From: {format(startDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className="bg-zinc-900 text-white" />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          To: {format(endDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                        <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="bg-zinc-900 text-white" />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        placeholder="Search by name, ID, or session..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 focus:ring-primary"
                      />
                    </div>
                    <Select value={historySessionType} onValueChange={setHistorySessionType}>
                      <SelectTrigger className="w-full sm:w-[150px] bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Session Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="all" className="text-white focus:bg-zinc-800">All Types</SelectItem>
                        <SelectItem value="GENERAL" className="text-white focus:bg-zinc-800">General</SelectItem>
                        <SelectItem value="MEETING" className="text-white focus:bg-zinc-800">Meeting</SelectItem>
                        <SelectItem value="WORKSHOP" className="text-white focus:bg-zinc-800">Workshop</SelectItem>
                        <SelectItem value="EVENT" className="text-white focus:bg-zinc-800">Event</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={historyStatus} onValueChange={setHistoryStatus}>
                      <SelectTrigger className="w-full sm:w-[150px] bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="all" className="text-white focus:bg-zinc-800">All Status</SelectItem>
                        <SelectItem value="PRESENT" className="text-white focus:bg-zinc-800">Present</SelectItem>
                        <SelectItem value="ABSENT" className="text-white focus:bg-zinc-800">Absent</SelectItem>
                        <SelectItem value="LATE" className="text-white focus:bg-zinc-800">Late</SelectItem>
                        <SelectItem value="EXCUSED" className="text-white focus:bg-zinc-800">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                        <TableHead className="text-gray-400">Date</TableHead>
                        <TableHead className="text-gray-400">Member</TableHead>
                        <TableHead className="text-gray-400">Department</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Session Type</TableHead>
                        <TableHead className="text-gray-400">Session Name</TableHead>
                        <TableHead className="text-gray-400">Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceHistory.length === 0 ? (
                        <TableRow className="border-zinc-800">
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            No attendance records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        attendanceHistory.map((record) => (
                          <TableRow key={record.id} className="border-zinc-800 hover:bg-zinc-800/50">
                            <TableCell className="whitespace-nowrap text-gray-300">{record.date}</TableCell>
                            <TableCell className="whitespace-nowrap text-gray-300">
                              {record.profile?.title || record.profile?.ecell_id || "Unknown"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-gray-300">
                              {record.profile?.department || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  record.status === "PRESENT" && "bg-green-600 hover:bg-green-700 text-white",
                                  record.status === "ABSENT" && "bg-red-600 hover:bg-red-700 text-white",
                                  record.status === "LATE" && "bg-yellow-600 hover:bg-yellow-700 text-white",
                                  record.status === "EXCUSED" && "bg-gray-600 hover:bg-gray-700 text-white"
                                )}
                              >
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="outline" className="border-zinc-700 text-gray-400">{record.session_type}</Badge>
                            </TableCell>
                            <TableCell className="text-gray-300">{record.session_name || "-"}</TableCell>
                            <TableCell className="text-gray-300">{record.location || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Attendance;
