import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, Plus, Loader2, Upload, CheckCircle2, XCircle, HelpCircle, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { hasRankAtLeast, isPresident } from "@/lib/rbac";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  cover_url: string | null;
  participants_count: number;
  is_active: boolean;
  created_by: string | null;
}

interface Participant {
  id: string;
  status: "GOING" | "MAYBE" | "NOT_GOING";
  user_id: string;
}

interface Profile {
  id: string;
  role: string;
  title: string | null;
}

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [userRSVPs, setUserRSVPs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    location: "",
    cover_url: "",
  });

  useEffect(() => {
    fetchUserProfile();
    fetchEvents();
    fetchUserRSVPs();

    const channel = supabase
      .channel("event-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        fetchEvents();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_participants" }, () => {
        fetchUserRSVPs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, role, title")
      .eq("user_id", user.id)
      .maybeSingle();

    setUserProfile(data);
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("event_date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRSVPs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return;

    const { data } = await supabase
      .from("event_participants")
      .select("event_id, status")
      .eq("user_id", profile.id);

    const rsvpMap: Record<string, string> = {};
    data?.forEach((rsvp) => {
      rsvpMap[rsvp.event_id] = rsvp.status;
    });
    setUserRSVPs(rsvpMap);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please upload an image file",
          variant: "destructive",
        });
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event-covers")
        .getPublicUrl(fileName);

      setFormData({ ...formData, cover_url: publicUrl });
      toast({
        title: "Success",
        description: "Cover image uploaded",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      if (!userProfile) throw new Error("User profile not found");

      const eventData = {
        title: formData.title,
        description: formData.description || null,
        event_date: formData.event_date,
        location: formData.location || null,
        cover_url: formData.cover_url || null,
        created_by: userProfile.id,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        toast({ title: "Success", description: "Event updated" });
      } else {
        const { error } = await supabase.from("events").insert([eventData]);
        if (error) throw error;
        toast({ title: "Success", description: "Event created" });
      }

      setIsCreateOpen(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ is_active: false })
        .eq("id", eventId);

      if (error) throw error;
      toast({ title: "Success", description: "Event deleted" });
      fetchEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const handleRSVP = async (eventId: string, status: "GOING" | "MAYBE" | "NOT_GOING") => {
    try {
      if (!userProfile) return;

      const { error } = await supabase
        .from("event_participants")
        .upsert({
          event_id: eventId,
          user_id: userProfile.id,
          status,
        });

      if (error) throw error;

      fetchUserRSVPs();
      fetchEvents();
      toast({ title: "Success", description: "RSVP updated" });
    } catch (error) {
      console.error("Error updating RSVP:", error);
      toast({
        title: "Error",
        description: "Failed to update RSVP",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      event_date: event.event_date.split("T")[0] + "T" + event.event_date.split("T")[1].substring(0, 5),
      location: event.location || "",
      cover_url: event.cover_url || "",
    });
    setIsCreateOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_date: "",
      location: "",
      cover_url: "",
    });
    setEditingEvent(null);
  };

  const canManageEvents = hasRankAtLeast(userProfile?.role, 3) || isPresident(userProfile?.title);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Events</h2>
            <p className="text-gray-400">Upcoming E-Cell events and activities</p>
          </div>
          {canManageEvents && (
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle className="text-white">{editingEvent ? "Edit Event" : "Create New Event"}</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    {editingEvent ? "Update event details" : "Fill in the event information"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-300">Event Title *</Label>
                    <Input
                      id="title"
                      placeholder="E-Summit 2025"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-gray-300">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Event description..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event_date" className="text-gray-300">Event Date & Time *</Label>
                    <Input
                      id="event_date"
                      type="datetime-local"
                      value={formData.event_date}
                      onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-gray-300">Location</Label>
                    <Input
                      id="location"
                      placeholder="Main Auditorium"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Cover Image</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="border-zinc-700 hover:bg-zinc-800"
                      >
                        {uploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Upload Image
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                    {formData.cover_url && (
                      <img
                        src={formData.cover_url}
                        alt="Cover preview"
                        className="mt-2 rounded-lg max-h-40 object-cover border border-zinc-700"
                      />
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-zinc-700 hover:bg-zinc-800">
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving || !formData.title || !formData.event_date} className="bg-primary hover:bg-primary/90">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingEvent ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {events.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <Calendar className="h-10 w-10 text-gray-600" />
              </div>
              <p className="text-lg font-medium text-white mb-1">No events yet</p>
              {canManageEvents && <p className="text-sm text-gray-400">Create your first event to get started</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Card key={event.id} className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden hover:border-primary/30 transition-all duration-300">
                {event.cover_url && (
                  <div className="h-48 overflow-hidden bg-zinc-800">
                    <img
                      src={event.cover_url}
                      alt={event.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <CardHeader className="border-b border-zinc-800">
                  <CardTitle className="flex justify-between items-start text-white">
                    <span>{event.title}</span>
                    {canManageEvents && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(event)}
                          className="h-8 w-8 hover:bg-zinc-800"
                        >
                          <Pencil className="h-4 w-4 text-gray-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(event.id)}
                          className="h-8 w-8 hover:bg-zinc-800"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-gray-400">
                    {event.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center text-sm text-gray-400">
                    <Calendar className="mr-2 h-4 w-4 text-primary" />
                    {format(new Date(event.event_date), "PPP 'at' p")}
                  </div>
                  {event.location && (
                    <div className="flex items-center text-sm text-gray-400">
                      <MapPin className="mr-2 h-4 w-4 text-primary" />
                      {event.location}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-400">
                    <Users className="mr-2 h-4 w-4 text-primary" />
                    {event.participants_count} participants
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 border-t border-zinc-800 pt-4">
                  <Button
                    size="sm"
                    variant={userRSVPs[event.id] === "GOING" ? "default" : "outline"}
                    onClick={() => handleRSVP(event.id, "GOING")}
                    className={userRSVPs[event.id] === "GOING" ? "flex-1 bg-green-600 hover:bg-green-700" : "flex-1 border-zinc-700 hover:bg-zinc-800"}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Going
                  </Button>
                  <Button
                    size="sm"
                    variant={userRSVPs[event.id] === "MAYBE" ? "default" : "outline"}
                    onClick={() => handleRSVP(event.id, "MAYBE")}
                    className={userRSVPs[event.id] === "MAYBE" ? "flex-1 bg-primary hover:bg-primary/90" : "flex-1 border-zinc-700 hover:bg-zinc-800"}
                  >
                    <HelpCircle className="mr-1 h-4 w-4" />
                    Maybe
                  </Button>
                  <Button
                    size="sm"
                    variant={userRSVPs[event.id] === "NOT_GOING" ? "default" : "outline"}
                    onClick={() => handleRSVP(event.id, "NOT_GOING")}
                    className={userRSVPs[event.id] === "NOT_GOING" ? "flex-1 bg-red-600 hover:bg-red-700" : "flex-1 border-zinc-700 hover:bg-zinc-800"}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    No
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;
