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
  const [userProfile, setUserProfile] = useState<{ role: string;[key: string]: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
    <div className="flex flex-col h-full bg-black border-r border-zinc-800">
      <div className="flex h-16 items-center px-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <span className="text-primary">E-Cell</span> GLA
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
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 transition-all duration-200",
                  isActive
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "text-gray-400 hover:text-white hover:bg-zinc-900",
                  !sidebarOpen && "md:justify-center md:px-2"
                )}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileOpen(false);
                }}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-gray-400")} />
                <span className={cn(
                  "transition-all duration-200",
                  !sidebarOpen && "md:hidden"
                )}>
                  {item.label}
                </span>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-zinc-800">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-red-500 hover:text-red-400 hover:bg-red-950/20",
            !sidebarOpen && "md:justify-center md:px-2"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span className={cn(!sidebarOpen && "md:hidden")}>Logout</span>
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

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-zinc-800 bg-black transition-all duration-300 ease-in-out z-50",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-800">
          {sidebarOpen && (
            <div className="font-bold text-xl text-white">
              <span className="text-primary">E-Cell</span> GLA
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-zinc-900 ml-auto"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {getMenuItems().map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 transition-all duration-200 mb-1",
                    isActive
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "text-gray-400 hover:text-white hover:bg-zinc-900",
                    !sidebarOpen && "justify-center px-2"
                  )}
                  onClick={() => navigate(item.path)}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-gray-400")} />
                  {sidebarOpen && <span>{item.label}</span>}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-red-500 hover:text-red-400 hover:bg-red-950/20",
              !sidebarOpen && "justify-center px-2"
            )}
            onClick={handleLogout}
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 bg-black border-b border-zinc-800">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <span className="text-primary">E-Cell</span> GLA
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-900">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-black border-zinc-800">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-black pt-16 md:pt-0">
        <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
          {/* Page Header - Hidden on mobile if redundant, or styled smaller */}
          {pageMeta[location.pathname] && (
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {pageMeta[location.pathname].title}
              </h1>
              {pageMeta[location.pathname].subtitle && (
                <p className="text-sm md:text-base text-gray-400 mt-1">
                  {pageMeta[location.pathname].subtitle}
                </p>
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
