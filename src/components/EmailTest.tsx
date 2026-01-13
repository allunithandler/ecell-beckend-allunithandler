import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Send, CheckCircle2, XCircle } from "lucide-react";

/**
 * EmailTest Component
 * 
 * A test utility component to verify the email system is working.
 * This should only be used in development/testing environments.
 * 
 * Usage: Import and add to a page (e.g., a settings or admin page)
 */
const EmailTest = () => {
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Call the test function via RPC
      const { data, error } = await supabase.rpc('test_send_email', {
        test_email: testEmail
      });

      if (error) throw error;

      setResult({
        success: true,
        message: `Test email sent successfully to ${testEmail}. Check your inbox!`
      });
      toast.success("Test email sent!", {
        description: `Check ${testEmail} for the test email.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test email";
      setResult({
        success: false,
        message
      });
      toast.error("Failed to send test email", {
        description: message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email System Test
        </CardTitle>
        <CardDescription>
          Send a test email to verify the Resend integration is working correctly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleTestEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Test Email Address</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="your-email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              required
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Enter an email address to receive the test email
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>Sending...</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>

          {result && (
            <div
              className={`p-4 rounded-lg border ${
                result.success
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {result.success ? "Success!" : "Error"}
                  </p>
                  <p className="text-sm mt-1">{result.message}</p>
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            ℹ️ About This Test
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Verifies Supabase → Edge Function → Resend connection</li>
            <li>• Sends a test email with E-Cell GLA branding</li>
            <li>• Check spam folder if you don't see the email</li>
            <li>• Only use for testing - not for production emails</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailTest;
