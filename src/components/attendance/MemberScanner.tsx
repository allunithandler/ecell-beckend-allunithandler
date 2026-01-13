import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Camera, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MemberScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false); // Ref to track scanning state synchronously
  const [result, setResult] = useState<{ status: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setScanning(true);
    scanningRef.current = true;
    setResult(null);
    setPermissionError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError("Camera API is not supported in this browser or context (requires HTTPS).");
      setScanning(false);
      scanningRef.current = false;
      return;
    }

    try {
      // First try environment camera
      await requestCamera({ facingMode: "environment" });
    } catch (err: any) {
      console.warn("Environment camera failed, trying user camera", err);
      try {
        // Fallback to user camera
        await requestCamera({ facingMode: "user" });
      } catch (err2: any) {
        // Fallback to any camera
        try {
           await requestCamera(true);
        } catch (err3: any) {
            handleCameraError(err3);
            setScanning(false);
            scanningRef.current = false;
        }
      }
    }
  };

  const requestCamera = async (constraints: MediaStreamConstraints["video"]) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true"); 
      await videoRef.current.play();
      requestAnimationFrame(tick);
    }
  };

  const handleCameraError = (error: any) => {
    console.error("Camera Error:", error);
    let msg = "Could not access camera.";
    
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      msg = "Camera permission denied. Please allow camera access in your browser settings.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      msg = "No camera found on this device.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      msg = "Camera is already in use by another application.";
    } else if (error.name === "OverconstrainedError") {
      msg = "Camera does not match the required constraints.";
    } else if (window.isSecureContext === false) {
      msg = "Camera access requires a secure connection (HTTPS).";
    }

    setPermissionError(msg);
    toast.error(msg);
  };

  const stopCamera = () => {
    setScanning(false);
    scanningRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code) {
          console.log("QR Code detected:", code.data);
          // Draw a box around the QR code
          ctx.beginPath();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "#FF3B58";
          ctx.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
          ctx.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
          ctx.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
          ctx.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
          ctx.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
          ctx.stroke();

          handleScan(code.data);
          return; // Stop scanning loop
        }
      }
    }
    
    if (scanningRef.current) {
      requestAnimationFrame(tick);
    }
  };

  const handleScan = async (data: string) => {
    stopCamera();
    setLoading(true);
    
    try {
      const parsed = JSON.parse(data);
      if (parsed.type !== "attendance" || !parsed.sessionId) {
        throw new Error("Invalid QR Code");
      }

      // Check if session exists and is active
      const { data: session, error: sessionError } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("id", parsed.sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error("Session not found");
      }

      if (!session.is_active) {
        throw new Error("This session has been closed");
      }

      // Check if QR code has expired
      if (session.expires_at) {
        const expiryTime = new Date(session.expires_at);
        const now = new Date();
        if (now > expiryTime) {
          throw new Error("QR Code has expired");
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch profile id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("User profile not found. Please contact admin.");
      }

      // Insert into attendance table
      const { error } = await supabase.from("attendance").insert({
        user_id: profile.id,
        session_id: parsed.sessionId,
        status: 'PRESENT',
        session_type: session.session_type || 'GENERAL',
        date: new Date().toISOString().split('T')[0]
      });

      if (error) {
        if (error.code === '23505') {
          setResult({ status: 'success', message: 'Already marked present!' });
        } else {
          throw error;
        }
      } else {
        setResult({ status: 'success', message: 'Attendance Marked Successfully!' });
        toast.success("Attendance Marked!");
      }

    } catch (err: any) {
      setResult({ status: 'error', message: err.message || "Failed to process QR code" });
      toast.error(err.message || "Failed to process QR code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Scan Attendance QR</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {result && (
          <Alert variant={result.status === 'success' ? 'default' : 'destructive'} className={result.status === 'success' ? 'border-green-500 bg-green-50 text-green-900' : ''}>
            {result.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <AlertTitle>{result.status === 'success' ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        {permissionError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Camera Error</AlertTitle>
            <AlertDescription>{permissionError}</AlertDescription>
          </Alert>
        )}

        <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
          {!scanning && !loading && !permissionError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button onClick={startCamera} size="lg">
                <Camera className="mr-2 h-4 w-4" /> Start Scanner
              </Button>
            </div>
          )}
          
          {permissionError && !scanning && (
             <div className="absolute inset-0 flex items-center justify-center">
             <Button onClick={startCamera} size="lg" variant="secondary">
               <Camera className="mr-2 h-4 w-4" /> Retry Camera
             </Button>
           </div>
          )}
          
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" hidden={!scanning} />
          <canvas ref={canvasRef} className="hidden" />
          
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>

        {scanning && (
          <Button variant="destructive" onClick={stopCamera}>
            Stop Camera
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
