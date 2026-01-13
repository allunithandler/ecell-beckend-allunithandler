import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, RefreshCw, Trash2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";

interface FacultyToken {
  id: string;
  faculty_name: string;
  faculty_email: string | null;
  token: string;
  expires_at: string;
}

export function FacultyManager() {
  const [tokens, setTokens] = useState<FacultyToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("faculty_view_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error) setTokens(data || []);
    setLoading(false);
  };

  const generateToken = async () => {
    if (!name) return toast.error("Faculty Name is required");

    const token = crypto.randomUUID();
    const expiresAt = addDays(new Date(), 7).toISOString(); // 7 days expiry default

    // Get current user profile id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return toast.error("Profile not found");

    const { error } = await supabase.from("faculty_view_tokens").insert({
      faculty_name: name,
      faculty_email: email || null,
      token,
      expires_at: expiresAt,
      created_by: profile.id
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Token generated successfully");
      setOpen(false);
      setName("");
      setEmail("");
      fetchTokens();
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/faculty/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("faculty_view_tokens").delete().eq("id", id);
    if (!error) {
      toast.success("Token deleted");
      fetchTokens();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Faculty Access Tokens</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Generate Token</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Faculty Access</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Faculty Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email (Optional)</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <Button onClick={generateToken} className="w-full">Generate 7-Day Access</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faculty Name</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No active tokens
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.faculty_name}</TableCell>
                    <TableCell>{new Date(t.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(t.token)}>
                        <Copy className="h-4 w-4 mr-2" /> Copy Link
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteToken(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
