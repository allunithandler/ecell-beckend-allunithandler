import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  CheckSquare,
  Users,
  Calendar,
  UserCircle,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppRole, permissions, isCommittee } from "@/lib/rbac";
import { useProfileCache } from "@/stores/profileCache";
import ThemeToggle from "@/components/ThemeToggle";
import Noise from "@/components/Noise";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface UserProfile {
  app_role: AppRole;
  id: string;
}

interface UserPosition {
  position_id: string;
  level: number;
  end_date: string | null;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const fetchUserData = async (userId: string) => {
      try {
        // Fetch profile with app_role
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, app_role")
          .eq("user_id", userId)
          .maybeSingle();

        if (!profile || !mounted) return;

        // Fetch active positions
        const { data: positions } = await supabase
          .from("user_positions")
          .select("position_id, level, end_date")
          .eq("user_id", profile.id);

        if (mounted) {
          setUserProfile({ app_role: profile.app_role as AppRole, id: profile.id });
          setUserPositions(positions || []);
        }
      } catch (error) {
        if (mounted) {
          setUserProfile({ app_role: "MEMBER", id: userId });
          setUserPositions([]);
        }
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          setUser(null);
          setUserProfile(null);
          setUserPositions([]);
          navigate("/auth", { replace: true });
          return;
        }

        setUser(session.user);
        await fetchUserData(session.user.id);
      } catch (error) {
        if (!mounted) return;
        setUser(null);
        setUserProfile(null);
        setUserPositions([]);
        navigate("/auth", { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === "SIGNED_OUT" || event === "USER_DELETED" || !session) {
        setUser(null);
        setUserProfile(null);
        setUserPositions([]);
        navigate("/auth", { replace: true });
        return;
      }
      
      setUser(session.user);
      await fetchUserData(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    if (!userProfile) return [];

    const baseItems = [
      { icon: Calendar, label: "Events", path: "/events" },
      { icon: UserCircle, label: "Profile", path: "/profile" },
    ];

    const restrictedItems = [];
    
    // Organization - Genie level and above or committee
    if (permissions.viewOrganization(userProfile, userPositions)) {
      restrictedItems.push({ icon: Users, label: "Organization", path: "/organization" });
    }

    // Tasks and Attendance - Committee and above
    if (isCommittee(userProfile)) {
      restrictedItems.push({ icon: CheckSquare, label: "Attendance", path: "/attendance" });
      restrictedItems.push({ icon: CheckSquare, label: "Tasks", path: "/tasks" });
    }

    return [...baseItems, ...restrictedItems];
  };

  const pageMeta: Record<string, { title: string; subtitle?: string }> = {
    "/attendance": { title: "Attendance", subtitle: "Mark and track member attendance" },
    "/tasks": { title: "Tasks", subtitle: "Manage team tasks" },
    "/events": { title: "Events", subtitle: "Upcoming events and activities" },
    "/organization": { title: "Organization", subtitle: "Team hierarchy and members" },
    "/profile": { title: "Profile", subtitle: "Manage your personal details" },
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-black border-r border-zinc-800 relative">
      <Noise
        patternSize={250}
        patternScaleX={1}
        patternScaleY={1}
        patternRefreshInterval={2}
        patternAlpha={6}
      />
      <div className="flex h-16 items-center px-6 border-b border-zinc-800">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <span className="text-primary">E-Cell</span> GLA
        </div>
      </div>
      <ScrollArea className="flex-1 px-4 py-6">
        <nav className="space-y-2">
          {getMenuItems().map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-4 transition-all duration-200 min-h-[52px] text-base font-medium",
                  isActive
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "text-gray-400 hover:text-white hover:bg-zinc-900"
                )}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileOpen(false);
                }}
              >
                <Icon className={cn("h-6 w-6", isActive ? "text-white" : "text-gray-400")} />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-zinc-800">
        <Button
          variant="ghost"
          className="w-full justify-start gap-4 text-red-500 hover:text-red-400 hover:bg-red-950/20 min-h-[52px] text-base font-medium"
          onClick={() => {
            handleLogout();
            setIsMobileOpen(false);
          }}
        >
          <LogOut className="h-6 w-6" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black relative">
      <Noise
        patternSize={250}
        patternScaleX={1}
        patternScaleY={1}
        patternRefreshInterval={2}
        patternAlpha={11}
      />
      
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-zinc-800 bg-black transition-all duration-300 ease-in-out z-50 relative",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <Noise
          patternSize={250}
          patternScaleX={1}
          patternScaleY={1}
          patternRefreshInterval={2}
          patternAlpha={6}
        />
        <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-800">
          {sidebarOpen && (
            <div className="font-bold text-xl text-white">
              <span className="text-primary">E-Cell</span> GLA
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-zinc-900 ml-auto min-h-[44px] min-w-[44px]"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-2">
            {getMenuItems().map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 transition-all duration-200 min-h-[44px] text-base",
                    isActive
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "text-gray-400 hover:text-white hover:bg-zinc-900",
                    !sidebarOpen && "justify-center px-2"
                  )}
                  onClick={() => navigate(item.path)}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-gray-400")} />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-red-500 hover:text-red-400 hover:bg-red-950/20 min-h-[44px] text-base",
              !sidebarOpen && "justify-center px-2"
            )}
            onClick={handleLogout}
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-black/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-2 font-bold text-lg text-white">
          <span className="text-primary">E-Cell</span> GLA
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-900 min-h-[44px] min-w-[44px]">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80 bg-black border-zinc-800">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-black pt-14 pb-20 lg:pt-0 lg:pb-0">
        <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-6">
          {/* Page Header */}
          {pageMeta[location.pathname] && (
            <div className="mb-6 lg:mb-8">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
                {pageMeta[location.pathname].title}
              </h1>
              {pageMeta[location.pathname].subtitle && (
                <p className="text-sm sm:text-base text-gray-400 mt-2 leading-relaxed">
                  {pageMeta[location.pathname].subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-t border-zinc-800">
        <div className="flex items-center justify-around py-2 px-4">
          {getMenuItems().slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={cn(
                  "flex flex-col items-center gap-1 min-h-[60px] min-w-[60px] p-2",
                  isActive
                    ? "text-primary"
                    : "text-gray-400 hover:text-white"
                )}
                onClick={() => navigate(item.path)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium truncate max-w-[50px]">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;