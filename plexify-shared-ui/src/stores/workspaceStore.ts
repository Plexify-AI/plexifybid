import { create } from 'zustand';
import {
  SourceMaterial,
  Message,
  Project,
  EditorBlock,
} from '../types';

export interface WorkspaceState {
  // Project data
  currentProject: Project | null;

  // Editor state
  content: string;
  blocks: EditorBlock[];
  isDirty: boolean;

  // Source materials
  sourceMaterials: SourceMaterial[];

  // AI Assistant
  messages: Message[];
  isAILoading: boolean;

  // Audio/Video
  audioUrl: string | null;
  videoUrl: string | null;

  // UI state
  isWorkspaceOpen: boolean;
  activePanel: 'sources' | 'editor' | 'assistant';

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setContent: (content: string) => void;
  setBlocks: (blocks: EditorBlock[]) => void;
  setIsDirty: (isDirty: boolean) => void;
  setSourceMaterials: (materials: SourceMaterial[]) => void;
  addSourceMaterial: (material: SourceMaterial) => void;
  removeSourceMaterial: (id: string) => void;
  reorderSourceMaterials: (materials: SourceMaterial[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setIsAILoading: (loading: boolean) => void;
  setAudioUrl: (url: string | null) => void;
  setVideoUrl: (url: string | null) => void;
  openWorkspace: () => void;
  closeWorkspace: () => void;
  setActivePanel: (panel: 'sources' | 'editor' | 'assistant') => void;
  reset: () => void;
}

const initialState = {
  currentProject: null,
  content: '',
  blocks: [],
  isDirty: false,
  sourceMaterials: [],
  messages: [],
  isAILoading: false,
  audioUrl: null,
  videoUrl: null,
  isWorkspaceOpen: false,
  activePanel: 'editor' as const,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,

  setCurrentProject: (project) =>
    set({ currentProject: project }),

  setContent: (content) =>
    set({ content, isDirty: true }),

  setBlocks: (blocks) =>
    set({ blocks, isDirty: true }),

  setIsDirty: (isDirty) =>
    set({ isDirty }),

  setSourceMaterials: (materials) =>
    set({ sourceMaterials: materials }),

  addSourceMaterial: (material) =>
    set((state) => ({
      sourceMaterials: [...state.sourceMaterials, material],
    })),

  removeSourceMaterial: (id) =>
    set((state) => ({
      sourceMaterials: state.sourceMaterials.filter((m) => m.id !== id),
    })),

  reorderSourceMaterials: (materials) =>
    set({ sourceMaterials: materials }),

  setMessages: (messages) =>
    set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  clearMessages: () =>
    set({ messages: [] }),

  setIsAILoading: (loading) =>
    set({ isAILoading: loading }),

  setAudioUrl: (url) =>
    set({ audioUrl: url }),

  setVideoUrl: (url) =>
    set({ videoUrl: url }),

  openWorkspace: () =>
    set({ isWorkspaceOpen: true }),

  closeWorkspace: () =>
    set({ isWorkspaceOpen: false }),

  setActivePanel: (panel) =>
    set({ activePanel: panel }),

  reset: () =>
    set(initialState),
}));
