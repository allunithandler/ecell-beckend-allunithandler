import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { SessionManager } from "@/components/attendance/SessionManager";
import { MemberScanner } from "@/components/attendance/MemberScanner";

// Keep existing history logic if needed, or we can refactor it later.
// For now, I will simplify this page to focus on the new requirements while keeping a placeholder for history.

interface Profile {
  id: string;
  user_id: string;
  role: "MENTOR" | "COMMITTEE" | "MEMBER";
}

const Attendance = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setProfile(data as Profile);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const isAdmin = profile?.role === "MENTOR" || profile?.role === "COMMITTEE";

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue={isAdmin ? "sessions" : "scan"} className="space-y-4">
        <TabsList>
          {isAdmin && <TabsTrigger value="sessions">Sessions</TabsTrigger>}
          <TabsTrigger value="scan">Scan QR</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="sessions" className="space-y-4">
            <SessionManager />
          </TabsContent>
        )}

        <TabsContent value="scan" className="space-y-4">
          <MemberScanner />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Attendance;
