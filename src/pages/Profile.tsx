import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, Download, Loader2, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import IdCardMockup from "@/components/IdCardMockup";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<'profiles'>;

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Set user email from auth
      setUserEmail(user.email || "Not available");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        setError("Failed to load profile");
        throw error;
      }

      setProfile(data);
      setFormData({
        name: data.name || "",
        phone: data.phone || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name || null,
          phone: formData.phone || null,
        })
        .eq("user_id", profile.user_id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, name: formData.name || null, phone: formData.phone || null } : null);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    
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
      const fileName = `${profile.user_id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ photo_url: publicUrl })
        .eq("user_id", profile.user_id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, photo_url: publicUrl } : null);
      toast({
        title: "Success",
        description: "Profile photo updated",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadSide = async (side: "front" | "back") => {
    const needFlip = (side === "back" && !showBack) || (side === "front" && showBack);
    if (needFlip) {
      setShowBack(side === "back");
      await new Promise((r) => setTimeout(r, 140));
    }

    const html2canvas = (await import("html2canvas")).default;
    const cardElement = document.getElementById('id-card');
    if (!cardElement) return;
    
    const canvas = await html2canvas(cardElement, {
      scale: 3,
      backgroundColor: null,
    });

    const link = document.createElement("a");
    link.download = `${profile?.ecell_id || "ecell"}-id-${side}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast({ title: "Downloaded", description: `Saved ${side} side as PNG` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">{error || "Profile not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Profile Settings</h2>
          <p className="text-gray-400">Manage your E-Cell identity and credentials</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile Information Card */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Photo Upload Section */}
              <div className="flex flex-col items-center space-y-4 py-4">
                <div className="relative group/avatar">
                  <Avatar className="h-32 w-32 ring-2 ring-primary/20 shadow-lg">
                    <AvatarImage src={profile.photo_url || ""} className="object-cover" />
                    <AvatarFallback className="text-4xl bg-zinc-800">
                      <User className="h-16 w-16 text-zinc-600" />
                    </AvatarFallback>
                  </Avatar>

                  <Button
                    size="icon"
                    className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
                    onClick={() => document.getElementById('photo-input')?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Camera className="h-4 w-4 text-white" />
                    )}
                  </Button>

                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>

                <Badge className="px-3 py-1 text-sm font-medium bg-primary text-white">
                  {profile.app_role}
                </Badge>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-300">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roll-no" className="text-sm font-medium text-gray-300">Roll Number</Label>
                  <Input
                    id="roll-no"
                    value={profile.roll_no || "Not available"}
                    disabled
                    className="bg-zinc-800 border-zinc-700 text-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-300">Email</Label>
                  <Input
                    id="email"
                    value={userEmail}
                    disabled
                    className="bg-zinc-800 border-zinc-700 text-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-300">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ecell-id" className="text-sm font-medium text-gray-300">E-Cell ID</Label>
                  <Input
                    id="ecell-id"
                    value={profile.ecell_id || "Not assigned"}
                    disabled
                    className="bg-zinc-800 border-zinc-700 text-gray-400 font-mono"
                  />
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-5"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Digital ID Card */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <Badge className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                  ID
                </Badge>
                Digital ID Card
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="space-y-6">
                <div id="id-card" className="transition-transform duration-300 hover:scale-[1.02]">
                  <IdCardMockup
                    name={profile.name || "Not available"}
                    rollNo={profile.roll_no || "Not available"}
                    email={userEmail}
                    phone={profile.phone || "Not available"}
                    appRole={profile.app_role}
                    ecellId={profile.ecell_id || "Not assigned"}
                    photoUrl={profile.photo_url}
                    back={showBack}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    onClick={() => setShowBack(!showBack)}
                    variant="secondary"
                    className="bg-zinc-800 hover:bg-zinc-700 border-zinc-700"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Flip Card
                  </Button>
                  <Button
                    onClick={() => downloadSide("front")}
                    variant="outline"
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Front
                  </Button>
                  <Button
                    onClick={() => downloadSide("back")}
                    variant="outline"
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
