import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  

  useEffect(() => {
    const resolveRedirect = async (session: Session | null) => {
      if (!session) return;
      const userId = session.user?.id;
      if (!userId) {
        navigate("/events");
        return;
      }
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        if (profile?.role === "MEMBER") {
          navigate("/events");
        } else {
          navigate("/attendance");
        }
      } catch {
        navigate("/events");
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await resolveRedirect(session);
      }
    });

    return () => {};
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        if (profile?.role === "MEMBER") {
          navigate("/events");
        } else {
          navigate("/attendance");
        }
      } else {
        navigate("/events");
      }
      toast.success("Logged in successfully!");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to login";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-black border-gray-800">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="text-2xl font-bold text-primary">E-Cell GLA</div>
          </div>
          <CardTitle className="text-2xl text-center text-white">Welcome</CardTitle>
          <CardDescription className="text-center text-gray-400">
            Management Platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-white">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="bg-gray-900 border-gray-700 text-white focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-white">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="bg-gray-900 border-gray-700 text-white focus:ring-primary"
              />
            </div>
            <Button type="submit" className="w-full bg-black border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;