import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban, AlertTriangle } from "lucide-react";
import { useProfileCache } from "@/stores/profileCache";

const Organization = () => {
  const { profile: currentUserProfile } = useProfileCache();

  // Check access - only COMMITTEE and MENTOR can view organization
  const hasAccess = currentUserProfile && 
    (currentUserProfile.app_role === 'COMMITTEE' || currentUserProfile.app_role === 'MENTOR');

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 bg-black text-white">
        <div className="text-center space-y-4">
          <Ban className="h-16 w-16 mx-auto text-red-500 opacity-50" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            You don't have permission to view the organization structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-12">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Organization</h1>
            <p className="text-gray-400">Team hierarchy and members</p>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <AlertTriangle className="h-16 w-16 text-amber-400 opacity-50" />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Organization Structure Unavailable</h3>
                <p className="text-gray-400 max-w-md">
                  This feature requires backend support for positions and assignments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Organization;