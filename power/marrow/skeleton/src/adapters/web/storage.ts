import { parseProfile, serialiseProfile } from '../../profile';
import type { Profile } from '../../types';

// Per-player settings in localStorage, wrapped in try/catch (Requirement 11.3).
// If storage is blocked or full, settings still work for this visit, in memory.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProfileStore {
  /** The saved profile, or null if there is none yet. */
  load(): Profile | null;
  save(profile: Profile): void;
}

export function createProfileStore(storage: StorageLike | undefined, key = 'marrow.profile'): ProfileStore {
  let memory: Profile | null = null;

  return {
    load() {
      try {
        const raw = storage?.getItem(key);
        if (raw) return parseProfile(raw);
      } catch {
        // Storage is blocked: fall back to this visit's settings.
      }
      return memory;
    },
    save(profile) {
      memory = profile;
      try {
        storage?.setItem(key, serialiseProfile(profile));
      } catch {
        // Storage is full or blocked: the in-memory copy still holds.
      }
    },
  };
}
