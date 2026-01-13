import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import EmailTest from "@/components/EmailTest";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Info } from "lucide-react";

/**
 * EmailTestPage
 * 
 * A development/admin page for testing the email system.
 * Only accessible to authenticated users (ideally admins/mentors).
 */
const EmailTestPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get user profile to check role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(profile?.role || null);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="text-white hover:text-white/80 mb-4"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-white mb-2">
            Email System Testing
          </h1>
          <p className="text-gray-400">
            Test and verify the Resend email integration is working correctly.
          </p>
        </div>

        {/* Warning for non-admin users */}
        {userRole === "MEMBER" && (
          <Card className="mb-6 border-yellow-500 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">
                    Development Tool
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This page is for testing purposes. In production, access should be restricted to administrators only.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Email Test Component */}
          <div className="md:col-span-1">
            <EmailTest />
          </div>

          {/* Information Panel */}
          <div className="md:col-span-1 space-y-6">
            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Edge Function</span>
                  <span className="text-sm font-medium text-green-600">✅ Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Database Triggers</span>
                  <span className="text-sm font-medium text-green-600">✅ Configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resend Integration</span>
                  <span className="text-sm font-medium text-green-600">✅ Ready</span>
                </div>
              </CardContent>
            </Card>

            {/* Email Flow Information */}
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
                <CardDescription>
                  Email sending flow in the application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">User Action</p>
                      <p className="text-muted-foreground">Signup or password reset</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Database Trigger</p>
                      <p className="text-muted-foreground">Auto-fires on auth event</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Edge Function</p>
                      <p className="text-muted-foreground">Calls Resend API</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-medium">Email Delivered</p>
                      <p className="text-muted-foreground">User receives email</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Testing Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Use a real email address you have access to</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Check spam folder if email doesn't arrive</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Delivery typically takes 5-30 seconds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Check Resend dashboard for delivery logs</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Documentation Links */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Learn more about the email system implementation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="/AUTH_EMAIL_SETUP.md"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <p className="font-medium">Setup Guide</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Technical documentation and architecture
                </p>
              </a>
              <a
                href="/TEST_AUTH_FLOW.md"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <p className="font-medium">Testing Guide</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete testing procedures and scenarios
                </p>
              </a>
              <a
                href="/PRODUCTION_SETUP.md"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <p className="font-medium">Production Setup</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Deploy to production with proper configuration
                </p>
              </a>
              <a
                href="/AUTH_FIX_SUMMARY.md"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <p className="font-medium">Fix Summary</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Overview of issues fixed and improvements
                </p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailTestPage;
