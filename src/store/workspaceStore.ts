import { create } from 'zustand';

interface WorkspaceState {
  isOpen: boolean;
  currentProjectId: string | null;

  openWorkspace: (projectId: string) => void;
  closeWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  isOpen: false,
  currentProjectId: null,

  openWorkspace: (projectId: string) => {
    const current = get();
    if (current.isOpen && current.currentProjectId !== projectId) {
      // Minimal handling for Phase 0; upgrade in later phases
      // eslint-disable-next-line no-console
      console.log(`Switching from project ${current.currentProjectId} to ${projectId}`);
    }
    set({ isOpen: true, currentProjectId: projectId });
  },

  closeWorkspace: () => set({ isOpen: false, currentProjectId: null }),
}));