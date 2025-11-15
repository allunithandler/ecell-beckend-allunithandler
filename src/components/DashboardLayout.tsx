import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Calendar, 
  UserCircle, 
  LogOut,
  X,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileCache } from "@/stores/profileCache";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; [key: string]: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (profile) {
          setUserProfile(profile);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { clearProfile } = useProfileCache();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Failed to logout. Please try again");
        return;
      }
      clearProfile();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch {
      toast.error("Failed to logout. Please try again");
    }
  };

  const getMenuItems = () => {
    const baseItems = [
      { icon: Calendar, label: "Events", path: "/events" },
      { icon: Users, label: "Organization", path: "/organization" },
      { icon: UserCircle, label: "Profile", path: "/profile" },
    ];

    // Only show restricted items to specific roles
    const restrictedItems = [];
    if (userProfile && ["MENTOR", "COMMITTEE", "DEPT_HEAD"].includes(userProfile.role)) {
      restrictedItems.push({ icon: CheckSquare, label: "Attendance", path: "/attendance" });
      restrictedItems.push({ icon: CheckSquare, label: "Tasks", path: "/tasks" });
    }

    return [...restrictedItems, ...baseItems];
  };

  const pageMeta: Record<string, { title: string; subtitle?: string }> = {
    "/dashboard": { title: "Dashboard", subtitle: "Welcome to E-Cell GLA Management Platform" },
    "/attendance": { title: "Attendance Management", subtitle: "Mark and track member attendance" },
    "/tasks": { title: "Task Management", subtitle: "Create and track tasks for team members" },
    "/events": { title: "Events", subtitle: "Plan and manage events" },
    "/organization": { title: "Organization", subtitle: "Team hierarchy and member directory" },
    "/profile": { title: "My Profile", subtitle: "Manage your profile and digital ID card" },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-64" : "w-0 md:w-16"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-primary">E-Cell GLA</div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-primary hover:bg-accent"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {getMenuItems().map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 hover:bg-accent hover:text-accent-foreground transition-all",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
                    !sidebarOpen && "justify-center px-2"
                  )}
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-gray-800 p-3">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-red-500 hover:text-red-400 hover:bg-red-950/20",
              !sidebarOpen && "justify-center px-2"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 overflow-y-auto transition-all duration-300 bg-background",
          sidebarOpen ? "ml-64" : "ml-0 md:ml-16"
        )}
      >
        <div className="container mx-auto p-6 space-y-6">
          {pageMeta[location.pathname] && (
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{pageMeta[location.pathname].title}</h1>
              {pageMeta[location.pathname].subtitle && (
                <p className="text-muted-foreground">{pageMeta[location.pathname].subtitle}</p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
