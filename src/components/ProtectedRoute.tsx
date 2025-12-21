import { ReactElement, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppRole, getPositionLevel, isCommittee } from "@/lib/rbac";

type ProtectedRouteProps = {
  children: ReactElement;
  requireCommittee?: boolean;
  requireMinLevel?: number;
  redirectTo?: string;
};

const ProtectedRoute = ({ children, requireCommittee, requireMinLevel, redirectTo = "/auth" }: ProtectedRouteProps) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        
        if (!user) {
          if (!cancelled) {
            setIsAuthenticated(false);
            setHasAccess(false);
          }
          return;
        }

        // Fetch profile with app_role
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, app_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile) {
          if (!cancelled) {
            setIsAuthenticated(false);
            setHasAccess(false);
          }
          return;
        }

        // Fetch active positions
        const { data: positions } = await supabase
          .from("user_positions")
          .select("position_id, level, end_date")
          .eq("user_id", profile.id)
          .is("end_date", null);

        const userPositions = positions || [];
        const userProfile = { app_role: profile.app_role as AppRole, id: profile.id };

        // FIX: ProtectedRoute must fail closed.
        // If no authorization requirements are provided, deny access to prevent silent fallthrough.
        const hasRequirements = requireCommittee !== undefined || requireMinLevel !== undefined;
        if (!hasRequirements) {
          if (!cancelled) {
            setIsAuthenticated(true); // User is authenticated...
            setHasAccess(false);      // ...but not authorized for this route as it has no rules.
          }
          return;
        }

        // Check access requirements (fail-closed)
        let access = true;
        
        if (requireCommittee === true) {
          access = isCommittee(userProfile);
        }
        
        if (requireMinLevel !== undefined) {
          const userLevel = getPositionLevel(userPositions);
          access = access && userLevel >= requireMinLevel;
        }

        if (!cancelled) {
          setIsAuthenticated(true);
          setHasAccess(access);
        }
      } catch (error) {
        if (!cancelled) {
          setIsAuthenticated(false);
          setHasAccess(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [requireCommittee, requireMinLevel]);

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (!hasAccess) {
    return <Navigate to="/events" replace />;
  }

  return children;
};

export default ProtectedRoute;