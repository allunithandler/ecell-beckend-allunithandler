import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, QrCode, FileUp, Download, Users, Calendar, Clock, MapPin, UserX, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

interface Session {
  id: string;
  session_name: string;
  notes: string;
  is_active: boolean;
  expires_at: string | null;
  mom_url: string | null;
  created_at: string;
  session_type: string;
  session_date: string;
  location: string | null;
}

export function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState<string | null>(null);
  const [attendeesOpen, setAttendeesOpen] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [absentees, setAbsentees] = useState<any[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionType, setSessionType] = useState("MEETING");
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [location, setLocation] = useState("");
  const [expiryHours, setExpiryHours] = useState("2");
  const [expiryMinutes, setExpiryMinutes] = useState("0");

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Failed to load sessions");
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  const fetchAttendees = async (sessionId: string) => {
    setAttendeesLoading(true);
    
    // Fetch attendees
    const { data: attendeesData, error: attendeesError } = await supabase
      .from("attendance")
      .select(`
        *,
        profiles:user_id (
          id,
          user_id,
          name,
          ecell_id,
          department,
          year,
          app_role,
          title
        )
      `)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (attendeesError) {
      toast.error("Failed to load attendees");
      setAttendeesLoading(false);
      return;
    }

    setAttendees(attendeesData || []);

    // Fetch all members to calculate absentees
    const { data: allMembers, error: membersError } = await supabase
      .from("profiles")
      .select("*")
      .order("name");

    if (membersError) {
      toast.error("Failed to load members");
      setAttendeesLoading(false);
      return;
    }

    // Calculate absentees - attendance.user_id is profiles.id
    const attendeeProfileIds = new Set(attendeesData?.map(a => a.user_id) || []);
    const absent = allMembers?.filter(m => !attendeeProfileIds.has(m.id)) || [];
    setAbsentees(absent);

    setAttendeesLoading(false);
  };

  const handleCreate = async () => {
    if (!title) return toast.error("Title is required");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return toast.error("Profile not found");

    // Calculate expiry time
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(expiryHours));
    expiryDate.setMinutes(expiryDate.getMinutes() + parseInt(expiryMinutes));

    const { error } = await supabase.from("attendance_sessions").insert({
      session_name: title,
      notes: description,
      created_by: profile.id,
      expires_at: expiryDate.toISOString(),
      is_active: true,
      session_type: sessionType,
      session_date: format(sessionDate, "yyyy-MM-dd"),
      location: location || null
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Session created successfully!");
      setCreateOpen(false);
      resetForm();
      fetchSessions();
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSessionType("MEETING");
    setSessionDate(new Date());
    setLocation("");
    setExpiryHours("2");
    setExpiryMinutes("0");
  };

  const handleMOMUpload = async (e: React.ChangeEvent<HTMLInputElement>, sessionId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Only PDF files allowed");

    const toastId = toast.loading("Uploading MOM...");
    const fileName = `${sessionId}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("moms")
      .upload(fileName, file);

    if (uploadError) {
      toast.dismiss(toastId);
      return toast.error("Upload failed: " + uploadError.message);
    }

    const { data: { publicUrl } } = supabase.storage.from("moms").getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("attendance_sessions")
      .update({ mom_url: publicUrl })
      .eq("id", sessionId);

    toast.dismiss(toastId);
    if (updateError) {
      toast.error("Failed to link MOM");
    } else {
      toast.success("MOM uploaded successfully!");
      fetchSessions();
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("attendance_sessions")
      .update({ is_active: !current })
      .eq("id", id);
    
    if (!error) {
      toast.success(current ? "Session closed" : "Session reopened");
      fetchSessions();
    }
  };

  const getSessionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      MEETING: "bg-blue-500",
      WORKSHOP: "bg-purple-500",
      EVENT: "bg-green-500",
      GENERAL: "bg-gray-500"
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Attendance Sessions</h2>
          <p className="text-gray-400 mt-1">Create and manage attendance for meetings, workshops, and events</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Create Session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Session</DialogTitle>
              <DialogDescription>
                Fill in the details to create a new attendance session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Session Title *
                  </Label>
                  <Input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="e.g. Weekly Team Meeting" 
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Session Type *</Label>
                  <Select value={sessionType} onValueChange={setSessionType}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEETING">Meeting</SelectItem>
                      <SelectItem value="WORKSHOP">Workshop</SelectItem>
                      <SelectItem value="EVENT">Event</SelectItem>
                      <SelectItem value="GENERAL">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Session Date *
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-11 justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(sessionDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={sessionDate}
                        onSelect={(date) => date && setSessionDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Location
                  </Label>
                  <Input 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    placeholder="e.g. Conference Room A, Online" 
                    className="h-11"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium">Description / Agenda</Label>
                  <Textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Meeting agenda, topics to discuss..." 
                    rows={4}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" /> QR Code Valid For
                  </Label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <Select value={expiryHours} onValueChange={setExpiryHours}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 hours</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="3">3 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-muted-foreground">and</span>
                    <div className="flex-1">
                      <Select value={expiryMinutes} onValueChange={setExpiryMinutes}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">QR code will expire after this duration from now</p>
                </div>
              </div>

              <Button onClick={handleCreate} className="w-full h-11 text-base">
                <Plus className="mr-2 h-5 w-5" /> Create Session
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Sessions Yet</h3>
            <p className="text-muted-foreground text-center mb-6">Create your first attendance session to get started</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map(session => (
            <Card key={session.id} className={`bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all ${!session.is_active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2">
                    <Badge className={`${getSessionTypeColor(session.session_type)} text-white`}>
                      {session.session_type}
                    </Badge>
                    <Badge variant={session.is_active ? "default" : "secondary"}>
                      {session.is_active ? "Active" : "Closed"}
                    </Badge>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleStatus(session.id, session.is_active)}
                    className="h-8 px-2"
                  >
                    {session.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </Button>
                </div>
                <CardTitle className="text-lg text-white">{session.session_name}</CardTitle>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(session.session_date).toLocaleDateString()}
                  </div>
                  {session.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {session.location}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                  {session.notes || "No description provided"}
                </p>
                
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Dialog open={attendeesOpen === session.id} onOpenChange={(open) => {
                      setAttendeesOpen(open ? session.id : null);
                      if (open) fetchAttendees(session.id);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                          <Users className="mr-2 h-4 w-4" /> Attendees
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                          <DialogTitle className="text-xl">{session.session_name}</DialogTitle>
                          <DialogDescription>
                            View attendance records for this session
                          </DialogDescription>
                        </DialogHeader>
                        
                        {attendeesLoading ? (
                          <div className="flex justify-center p-12">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          </div>
                        ) : (
                          <Tabs defaultValue="present" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="present" className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Present ({attendees.length})
                              </TabsTrigger>
                              <TabsTrigger value="absent" className="flex items-center gap-2">
                                <UserX className="h-4 w-4" />
                                Absent ({absentees.length})
                              </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="present" className="flex-1 overflow-y-auto mt-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Year</TableHead>
                                    <TableHead>Time</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {attendees.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No one has marked attendance yet
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    attendees.map((record) => (
                                      <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                          <div className="flex flex-col">
                                            <span>{record.profiles?.name || "Unknown"}</span>
                                            <span className="text-xs text-muted-foreground">{record.profiles?.ecell_id}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex flex-col gap-1">
                                            <Badge variant="secondary" className="w-fit text-xs">
                                              {record.profiles?.app_role}
                                            </Badge>
                                            {record.profiles?.title && (
                                              <span className="text-xs text-muted-foreground">{record.profiles?.title}</span>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>{record.profiles?.department || "-"}</TableCell>
                                        <TableCell>{record.profiles?.year || "-"}</TableCell>
                                        <TableCell className="text-xs">
                                          {new Date(record.created_at).toLocaleTimeString()}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </TabsContent>

                            <TabsContent value="absent" className="flex-1 overflow-y-auto mt-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Year</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {absentees.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        Everyone is present! 🎉
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    absentees.map((member) => (
                                      <TableRow key={member.id}>
                                        <TableCell className="font-medium">
                                          <div className="flex flex-col">
                                            <span>{member.name || "Unknown"}</span>
                                            <span className="text-xs text-muted-foreground">{member.ecell_id}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex flex-col gap-1">
                                            <Badge variant="secondary" className="w-fit text-xs">
                                              {member.app_role}
                                            </Badge>
                                            {member.title && (
                                              <span className="text-xs text-muted-foreground">{member.title}</span>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>{member.department || "-"}</TableCell>
                                        <TableCell>{member.year || "-"}</TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </TabsContent>
                          </Tabs>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog open={qrOpen === session.id} onOpenChange={(open) => setQrOpen(open ? session.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                          <QrCode className="mr-2 h-4 w-4" /> QR Code
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md flex flex-col items-center">
                        <DialogHeader>
                          <DialogTitle className="text-center">{session.session_name}</DialogTitle>
                          <DialogDescription className="text-center">
                            Scan this QR code to mark attendance
                          </DialogDescription>
                        </DialogHeader>
                        <div className="w-full space-y-4">
                          <div className="p-8 bg-white rounded-xl shadow-lg mx-auto w-fit">
                            <QRCodeSVG 
                              value={JSON.stringify({ 
                                sessionId: session.id, 
                                type: "attendance",
                                title: session.session_name,
                                date: session.session_date,
                                location: session.location,
                                sessionType: session.session_type
                              })} 
                              size={280}
                              level="H"
                            />
                          </div>
                          
                          <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge className={`${getSessionTypeColor(session.session_type)} text-white`}>
                                {session.session_type}
                              </Badge>
                              <span className="text-white font-medium">{session.session_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {new Date(session.session_date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </div>
                            {session.location && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {session.location}
                              </div>
                            )}
                            {session.expires_at && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                Valid until {new Date(session.expires_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {session.mom_url ? (
                    <Button variant="secondary" size="sm" className="w-full h-9" asChild>
                      <a href={session.mom_url} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" /> Download MOM
                      </a>
                    </Button>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleMOMUpload(e, session.id)}
                      />
                      <Button variant="outline" size="sm" className="w-full h-9 relative">
                        <FileUp className="mr-2 h-4 w-4" /> Upload MOM (PDF)
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
