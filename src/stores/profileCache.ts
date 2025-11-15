import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileCache {
  name: string | null;
  role: string | null;
  ecell_id: string | null;
  photo_url: string | null;
  lastUpdated: number;
}

interface ProfileCacheStore {
  profile: ProfileCache | null;
  setProfile: (profile: ProfileCache) => void;
  clearProfile: () => void;
  isStale: () => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useProfileCache = create<ProfileCacheStore>()(
  persist(
    (set, get) => ({
      profile: null,
      setProfile: (profile) => set({ profile: { ...profile, lastUpdated: Date.now() } }),
      clearProfile: () => set({ profile: null }),
      isStale: () => {
        const { profile } = get();
        if (!profile) return true;
        return Date.now() - profile.lastUpdated > CACHE_DURATION;
      },
    }),
    {
      name: 'profile-cache',
      partialize: (state) => ({ profile: state.profile }),
    }
  )
);