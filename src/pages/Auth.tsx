import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Noise from "@/components/Noise";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { sendEmail, getSignupWelcomeEmailHTML, getPasswordResetEmailHTML, getPasswordChangedEmailHTML } from "@/lib/email_templates";

type AuthMode = "login" | "signup" | "verify" | "reset";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [sessionUser, setSessionUser] = useState<Session | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionUser(session);
        redirectUser(session.user.id);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionUser(session);
        redirectUser(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const redirectUser = async (userId: string) => {
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

  const validateEmail = (email: string) => {
    return email.includes("@");
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast.error("Email must be @gla.ac.in");
      setLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      toast.error("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Profile creation is now handled by a database trigger (handle_new_user)
        // This ensures profile is created even if client-side operations fail
        
        toast.success("Signup successful!");
        setMode("verify");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Signup failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Logged in successfully!");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);

      if (error) throw error;

      // Email sending disabled for now
      // const resetUrl = `${window.location.origin}/auth?mode=reset`;
      // await sendEmail({
      //   to: resetEmail,
      //   subject: "Reset Your E-Cell GLA Password",
      //   html: getPasswordResetEmailHTML(resetUrl),
      // });

      toast.success("Password reset email sent! Check your inbox.");
      setResetEmail("");
      setMode("login");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Reset failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <Noise
        patternSize={250}
        patternScaleX={1}
        patternScaleY={1}
        patternRefreshInterval={2}
        patternAlpha={11}
      />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Card className="w-full max-w-sm sm:max-w-md bg-black/80 border-gray-800 relative z-10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="text-2xl sm:text-3xl font-bold text-primary animate-in fade-in duration-700">E-Cell GLA</div>
          </div>
          <CardTitle className="text-xl sm:text-2xl text-white">
            {mode === "login" && "Welcome Back"}
            {mode === "signup" && "Create Account"}
            {mode === "verify" && "Verify Email"}
            {mode === "reset" && "Reset Password"}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-400">
            {mode === "login" && "Sign in to your account"}
            {mode === "signup" && "Join E-Cell GLA"}
            {mode === "verify" && "Check your email for verification link"}
            {mode === "reset" && "Enter your email to reset password"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-white text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@gla.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-700 text-white focus:ring-primary h-12 text-base transition-all duration-200 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-white text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-700 text-white focus:ring-primary h-12 text-base transition-all duration-200 focus:border-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-medium transition-all duration-200 transform hover:scale-105"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-black text-gray-400">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-900 h-12 text-base transition-all duration-200"
                onClick={() => {
                  setMode("signup");
                  setEmail("");
                  setPassword("");
                }}
              >
                Create New Account
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-primary hover:text-primary/80 h-10 text-sm"
                onClick={() => {
                  setMode("reset");
                  setEmail("");
                  setPassword("");
                }}
              >
                Forgot Password?
              </Button>
            </form>
          )}

          {/* Signup Form */}
          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-white text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@gla.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-700 text-white focus:ring-primary h-12 text-base transition-all duration-200 focus:border-primary"
                />

              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-white text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-700 text-white focus:ring-primary h-12 text-base transition-all duration-200 focus:border-primary"
                />
                <p className="text-xs text-gray-500">Minimum 6 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-700 text-white focus:ring-primary h-12 text-base transition-all duration-200 focus:border-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-medium transition-all duration-200 transform hover:scale-105"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Sign Up"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-400 hover:text-white h-10 text-sm"
                onClick={() => {
                  setMode("login");
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                Already have an account? Sign In
              </Button>
            </form>
          )}

          {/* Verify Email */}
          {mode === "verify" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse" />
                  <CheckCircle2 className="h-16 w-16 text-primary relative" />
                </div>
              </div>
              <div className="bg-blue-950/30 border border-blue-500/30 rounded-lg p-4 space-y-2">
                <p className="text-sm text-blue-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Verification email sent!
                </p>
                <p className="text-xs text-blue-300">
                  Click the link in your email to verify your account. You can then sign in.
                </p>
              </div>
              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-medium transition-all duration-200"
                onClick={() => {
                  setMode("login");
                  setEmail("");
                  setPassword("");
                }}
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {/* Reset Password */}
          {mode === "reset" && (
            <form onSubmit={handlePasswordReset} className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-white text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@gla.ac.in"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-700 text-white focus:ring-primary h-12 text-base transition-all duration-200 focus:border-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-medium transition-all duration-200 transform hover:scale-105"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-400 hover:text-white h-10 text-sm"
                onClick={() => {
                  setMode("login");
                  setResetEmail("");
                }}
              >
                Back to Sign In
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;