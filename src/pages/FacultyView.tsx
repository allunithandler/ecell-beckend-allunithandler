import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Calendar, Users } from "lucide-react";
import { toast } from "sonner";

interface Session {
  id: string;
  title: string;
  description: string;
  mom_url: string | null;
  created_at: string;
  attendee_count: number;
}

interface FacultyData {
  faculty_name: string;
  sessions: Session[];
}

export default function FacultyView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<FacultyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchData(token);
    }
  }, [token]);

  const fetchData = async (tokenVal: string) => {
    setLoading(true);
    // Call the RPC function
    const { data: result, error: rpcError } = await supabase.rpc('get_faculty_dashboard', {
      token_input: tokenVal
    });

    if (rpcError) {
      console.error(rpcError);
      setError("Failed to load data");
    } else if (result && (result as any).error) {
      setError((result as any).error);
    } else {
      setData(result as FacultyData);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>{error || "Invalid or expired token"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Faculty Portal</h1>
            <p className="text-muted-foreground">Welcome, {data.faculty_name}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString()}
          </div>
        </div>

        <div className="grid gap-6">
          {data.sessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No sessions found.
              </CardContent>
            </Card>
          ) : (
            data.sessions.map(session => (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{session.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(session.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {session.mom_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={session.mom_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" /> Download MOM
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{session.description || "No description provided."}</p>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.attendee_count} Attendees
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
