import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, Loader2, User, UserPlus, UserMinus } from "lucide-react";
import { useProfileCache } from "@/stores/profileCache";
import { toast } from "sonner";

interface Position {
  id: string;
  name: string;
  level: number;
  is_committee: boolean;
  reports_to_id: string | null;
}

interface UserPosition {
  id: string;
  user_profile_id: string;
  position_id: string;
  start_date: string | null;
  end_date: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  app_role: string;
  name: string | null;
  ecell_id: string | null;
  title: string | null;
  photo_url: string | null;
  department: string | null;
}

interface UserWithPosition {
  profile: Profile;
  userPosition: UserPosition;
}

interface PositionWithUsers {
  position: Position;
  users: UserWithPosition[];
}

const Organization = () => {
  const { profile: currentUserProfile } = useProfileCache();
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsWithUsers, setPositionsWithUsers] = useState<PositionWithUsers[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [currentUserHighestLevel, setCurrentUserHighestLevel] = useState<number>(0);
  const [canEdit, setCanEdit] = useState(false);

  // Dialog state for assigning positions
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Check access - only COMMITTEE and MENTOR can view organization
  const hasAccess = currentUserProfile &&
    (currentUserProfile.app_role === 'COMMITTEE' || currentUserProfile.app_role === 'MENTOR');

  useEffect(() => {
    if (hasAccess) {
      fetchOrganizationData();
    }
  }, [hasAccess]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);

      // Get current user's profile ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!currentProfile) return;
      setCurrentUserProfileId(currentProfile.id);

      // Fetch all positions ordered by level DESC
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .order('level', { ascending: false });

      if (positionsError) throw positionsError;
      setPositions(positionsData || []);

      // Fetch all active user_positions (end_date IS NULL)
      const { data: userPositionsData, error: userPositionsError } = await supabase
        .from('user_positions')
        .select('*')
        .is('end_date', null);

      if (userPositionsError) throw userPositionsError;

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, app_role, name, ecell_id, title, photo_url, department')
        .order('name');

      if (profilesError) throw profilesError;
      setAllProfiles(profilesData || []);

      // Get current user's highest position level
      const currentUserPositions = (userPositionsData || []).filter(
        up => up.user_profile_id === currentProfile.id
      );
      const userLevels = currentUserPositions
        .map(up => {
          const pos = (positionsData || []).find(p => p.id === up.position_id);
          return pos?.level || 0;
        })
        .filter(level => typeof level === 'number');

      const highestLevel = userLevels.length > 0 ? Math.max(...userLevels) : 0;
      setCurrentUserHighestLevel(highestLevel);

      // Determine edit permissions: MENTOR or President (level 5)
      const canEditOrg = currentUserProfile?.app_role === 'MENTOR' || highestLevel === 5;
      setCanEdit(canEditOrg);

      // Join data: group users by position
      const positionsWithUsersData: PositionWithUsers[] = (positionsData || []).map(position => {
        const usersInPosition = (userPositionsData || [])
          .filter(up => up.position_id === position.id)
          .map(up => {
            const profile = (profilesData || []).find(p => p.id === up.user_profile_id);
            return profile ? { profile, userPosition: up } : null;
          })
          .filter((item): item is UserWithPosition => item !== null);

        return {
          position,
          users: usersInPosition,
        };
      });

      setPositionsWithUsers(positionsWithUsersData);
    } catch (error) {
      console.error('Error fetching organization data:', error);
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPosition = async () => {
    if (!selectedProfileId || !selectedPositionId) {
      toast.error('Please select both a user and a position');
      return;
    }

    try {
      setAssigning(true);

      const { error } = await supabase
        .from('user_positions')
        .insert({
          user_profile_id: selectedProfileId,
          position_id: selectedPositionId,
          start_date: new Date().toISOString().split('T')[0],
          end_date: null,
        });

      if (error) throw error;

      toast.success('Position assigned successfully');
      setAssignDialogOpen(false);
      setSelectedProfileId('');
      setSelectedPositionId('');
      await fetchOrganizationData();
    } catch (error: unknown) {
      console.error('Error assigning position:', error);
      const message = error instanceof Error ? error.message : 'Failed to assign position';
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemovePosition = async (userPositionId: string) => {
    if (!confirm('Are you sure you want to remove this position?')) return;

    try {
      const { error } = await supabase
        .from('user_positions')
        .update({ end_date: new Date().toISOString().split('T')[0] })
        .eq('id', userPositionId);

      if (error) throw error;

      toast.success('Position removed successfully');
      await fetchOrganizationData();
    } catch (error: unknown) {
      console.error('Error removing position:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove position';
      toast.error(message);
    }
  };

  const getProfileDisplayName = (profile: Profile) => {
    return profile.name || profile.ecell_id || profile.title || 'Unknown User';
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          {canEdit && (
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign Position
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Assign Position</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Assign a position to a team member
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Select User</label>
                    <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {allProfiles.map(profile => (
                          <SelectItem
                            key={profile.id}
                            value={profile.id}
                            className="text-white focus:bg-zinc-800"
                          >
                            {getProfileDisplayName(profile)}
                            {profile.department && ` (${profile.department})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Select Position</label>
                    <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Choose a position" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {positions.map(position => (
                          <SelectItem
                            key={position.id}
                            value={position.id}
                            className="text-white focus:bg-zinc-800"
                          >
                            {position.name} (Level {position.level})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAssignDialogOpen(false)}
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignPosition}
                    disabled={!selectedProfileId || !selectedPositionId || assigning}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Assign
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-6">
          {positionsWithUsers.map((pwu, index) => {
            const indentLevel = positions.length - index - 1;
            const indentClass = indentLevel > 0 ? `ml-${Math.min(indentLevel * 8, 32)}` : '';

            return (
              <Card
                key={pwu.position.id}
                className={`bg-zinc-900 border-zinc-800 shadow-xl transition-all duration-300 ${indentClass}`}
                style={{ marginLeft: `${indentLevel * 2}rem` }}
              >
                <CardHeader className="border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl font-semibold text-white">
                        {pwu.position.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="text-xs border-primary text-primary"
                      >
                        Level {pwu.position.level}
                      </Badge>
                      {pwu.position.is_committee && (
                        <Badge
                          variant="outline"
                          className="text-xs border-blue-400 text-blue-400"
                        >
                          Committee
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {pwu.users.length} {pwu.users.length === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {pwu.users.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No members assigned to this position</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {pwu.users.map(({ profile, userPosition }) => (
                        <div
                          key={userPosition.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors"
                        >
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage src={profile.photo_url || undefined} />
                            <AvatarFallback className="bg-zinc-700 text-white">
                              {getProfileDisplayName(profile).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate text-sm">
                              {getProfileDisplayName(profile)}
                            </div>
                            {profile.department && (
                              <div className="text-xs text-gray-400 truncate">
                                {profile.department}
                              </div>
                            )}
                            {profile.ecell_id && (
                              <div className="text-xs text-gray-500 truncate">
                                {profile.ecell_id}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemovePosition(userPosition.id)}
                              className="flex-shrink-0 h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                              title="Remove position"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {positionsWithUsers.length === 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8">
              <div className="text-center text-gray-500">
                <p>No positions found in the organization structure</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Organization;
