import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, Download, Loader2, User, Wifi, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import IdCardMockup from "@/components/IdCardMockup";
import { ProfileNameInput } from "@/components/ProfileNameInput";
import { useProfileCache } from "@/stores/profileCache";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

interface Profile {
  id: string;
  user_id: string;
  role: string;
  year: number;
  title: string | null;
  ecell_id: string | null;
  photo_url: string | null;
  phone: string | null;
  department: string | null;
  name: string | null;
}

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCardRef = useRef<HTMLDivElement>(null);
  const [showBack, setShowBack] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile: cachedProfile, setProfile: setCachedProfile, isStale } = useProfileCache();

  const [formData, setFormData] = useState({
    title: "",
    phone: "",
    department: "",
  });
  const [phoneChangedOnce, setPhoneChangedOnce] = useState(false);
  const isTechnicalAdmin = ((profile?.title || "").toLowerCase().includes("technical") && (profile?.title || "").toLowerCase().includes("admin"));

  useEffect(() => {
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setEmail(user.email || "");
      
      // Check cache first
      if (cachedProfile && !isStale()) {
        setProfile({
          id: cachedProfile.ecell_id || "",
          user_id: user.id,
          role: cachedProfile.role || "",
          year: 0,
          title: "",
          ecell_id: cachedProfile.ecell_id || "",
          photo_url: cachedProfile.photo_url || null,
          phone: "",
          department: "",
          name: cachedProfile.name || "",
        });
        setUserName(cachedProfile.name || "");
        setLoading(false);
        return;
      }

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metaName = typeof metadata.name === "string" ? metadata.name : (typeof metadata.full_name === "string" ? metadata.full_name : "");
      setUserName(metaName || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      type SupabaseProfileRow = Tables<'profiles'> & { name?: string | null };
      const row = data as SupabaseProfileRow;
      const profileData: Profile = { ...row, name: row.name ?? null };
      setProfile(profileData);
      setUserName(profileData.name || userName || "");
      
      // Update cache
      setCachedProfile({
        name: profileData.name || null,
        role: profileData.role || null,
        ecell_id: profileData.ecell_id || null,
        photo_url: profileData.photo_url || null,
        lastUpdated: Date.now(),
      });
      
      setFormData({
        title: data.title || "",
        phone: data.phone || "",
        department: data.department || "",
      });
      try {
        const flag = localStorage.getItem(`phoneChangedOnce:${data.id}`);
        setPhoneChangedOnce(flag === "true");
      } catch (e) {
        console.warn("Failed to read phoneChangedOnce", e);
      }
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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (profile?.photo_url && !isTechnicalAdmin) {
        toast({
          title: "Photo change blocked",
          description: "Only Technical Admin can change photo once set",
          variant: "destructive",
        });
        return;
      }
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

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
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfile((prev) => prev ? { ...prev, photo_url: publicUrl } : null);
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

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const isTechnicalAdminLocal = ((profile?.title || "").toLowerCase().includes("technical") && (profile?.title || "").toLowerCase().includes("admin"));

      const willChangePhone = formData.phone !== (profile?.phone || "");
      if (willChangePhone && profile?.phone && !isTechnicalAdminLocal) {
        toast({
          title: "Phone change blocked",
          description: "Phone number can only be changed once. Contact Admin for further changes.",
          variant: "destructive",
        });
        return;
      }

      const updates: Record<string, unknown> = {};
      if (isTechnicalAdminLocal) {
        updates.title = formData.title || null;
        updates.department = formData.department || null;
      }
      if (willChangePhone) {
        updates.phone = formData.phone || null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, ...formData } : null);
      if (willChangePhone && !phoneChangedOnce && !isTechnicalAdmin) {
        try {
          localStorage.setItem(`phoneChangedOnce:${profile?.id}`, "true");
          setPhoneChangedOnce(true);
        } catch (e) {
          console.warn("Failed to set phoneChangedOnce", e);
        }
      }
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

  const downloadSide = async (side: "front" | "back") => {
    if (!idCardRef.current) return;

    // Ensure the requested side is visible before capture
    const needFlip = (side === "back" && !showBack) || (side === "front" && showBack);
    if (needFlip) {
      setShowBack(side === "back");
      await new Promise((r) => setTimeout(r, 140)); // wait for flip animation paint
    }

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(idCardRef.current!, {
      scale: 3,
      backgroundColor: null, // keep dark/metallic backgrounds
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

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  const roleCardTheme = (role: string) => {
    switch (role) {
      case "MENTOR": // Platinum
        return {
          container: "bg-gradient-to-br from-[#0c0d10] via-[#14161a] to-[#1a1d22] border-[#2a2d33]",
          badge: "bg-[#eef2f7] text-[#0f172a] border border-[#d1d5db]",
          avatarRing: "ring-2 ring-[#cfd6de]",
          accent: "bg-gradient-to-b from-[#cfd6de] to-[#b7c1cc]",
        };
      case "DEPT_HEAD": // Gold (deep)
        return {
          container: "bg-gradient-to-br from-[#0c0d10] via-[#14161a] to-[#1a1d22] border-[#2a2d33]",
          badge: "bg-[#f6e3a8] text-[#2b2b2b] border border-[#e1c16d]",
          avatarRing: "ring-2 ring-[#e1c16d]",
          accent: "bg-gradient-to-b from-[#f1c859] to-[#d8ab3a]",
        };
      case "COMMITTEE": // Gold (classic)
        return {
          container: "bg-gradient-to-br from-[#0c0d10] via-[#14161a] to-[#1a1d22] border-[#2a2d33]",
          badge: "bg-[#f7e7b0] text-[#2b2b2b] border border-[#e1c16d]",
          avatarRing: "ring-2 ring-[#e1c16d]",
          accent: "bg-gradient-to-b from-[#f4d46a] to-[#d8b347]",
        };
      default: // Member - Neutral
        return {
          container: "bg-gradient-to-br from-[#0c0d10] via-[#14161a] to-[#1a1d22] border-[#2a2d33]",
          badge: "bg-[#f3f4f6] text-[#111827] border border-[#d1d5db]",
          avatarRing: "ring-2 ring-[#d1d5db]",
          accent: "bg-gradient-to-b from-[#e5e7eb] to-[#d1d5db]",
        };
    }
  };

  return (
    <div className="space-y-6">

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-600">
              You can enter your Details once. After that only Technical Admin can change it.
            </div>
            {/* Photo Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={profile.photo_url || ""} />
                  <AvatarFallback className="text-3xl">
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || (!!profile.photo_url && !isTechnicalAdmin)}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              <div className="text-center">
                <Badge className={cn("mb-2", roleCardTheme(profile.role).badge)}>
                  {profile.role}
                </Badge>
                <p className="text-sm text-muted-foreground">Year {profile.year}</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Name Field */}
              <ProfileNameInput
                initialValue={profile.name || userName || ""}
                onSave={async (name) => {
                  type ProfileUpdateWithName = TablesUpdate<'profiles'> & { name?: string | null };
                  const payload: ProfileUpdateWithName = { name };
                  const { error } = await supabase
                    .from("profiles")
                    .update(payload)
                    .eq("user_id", profile.user_id);
                  if (error) throw error;
                  setProfile((prev) => prev ? { ...prev, name } : null);
                  setUserName(name);
                  // Update cache
                  setCachedProfile({
                    name,
                    role: profile.role,
                    ecell_id: profile.ecell_id,
                    photo_url: profile.photo_url,
                    lastUpdated: Date.now(),
                  });
                }}
                disabled={Boolean(profile.name) && !isTechnicalAdmin}
              />


              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ecell-id">E-Cell ID</Label>
                <Input id="ecell-id" value={profile.ecell_id || "Not assigned"} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Position</Label>
                <Input
                  id="title"
                  placeholder="e.g., Technical Lead"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={(profile?.role || "").toLowerCase() !== "technical_admin"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="e.g., Technology"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  disabled={(profile?.role || "").toLowerCase() !== "technical_admin"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!!profile.phone && !isTechnicalAdmin}
                />
              </div>

              <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Digital ID Card (single, interactive flip) */}
        <Card>
          <CardHeader>
            <CardTitle>Digital ID Card</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div ref={idCardRef}>
                {
                  (() => {
                    const nameFromEmail = (email: string) => {
                      const base = email.split("@")[0].replace(/[._-]+/g, " ");
                      return base.replace(/\b\w/g, (c) => c.toUpperCase());
                    };
                    const name = userName || nameFromEmail(email);
                    const membershipNo = profile.ecell_id || "ECELL-XXXX";
                    const expiryLabel = formData.title || profile.title || "";
                    const tier = profile.role === "MENTOR" ? "Platinum" : profile.role === "COMMITTEE" || profile.role === "DEPT_HEAD" ? "Gold" : "Silver";

                    return (
                      <IdCardMockup
                        name={name}
                        membershipNo={membershipNo}
                        expiryLabel={expiryLabel}
                        tier={tier}
                        role={profile.role}
                        photoUrl={profile.photo_url || undefined}
                        contactEmail="lostcard@yourcompany.com"
                        back={showBack}
                        phone={profile.phone}
                        email={email}
                      />
                    );
                  })()
                }
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => setShowBack((v) => !v)} variant="secondary">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Flip Card
                </Button>
                <Button onClick={() => downloadSide("front")} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Front
                </Button>
                <Button onClick={() => downloadSide("back")} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Back
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
