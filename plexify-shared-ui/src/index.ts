// Components
export * from './components/workspace';

// Stores
export * from './stores';

// Utils
export * from './utils';

// Types
export * from './types';

// Re-export commonly used types for convenience
export type {
  PlexifyTheme,
  TerminologySet,
  SourceMaterial,
  Message,
  Project,
  EditorBlock,
  WorkspaceConfig,
  AudioChapter,
  SuggestedAction,
  TerminologyConfig,
} from './types';

// Re-export pre-defined themes
export { defaultTheme, aecTheme, bidTheme, bizTheme } from './types/theme';

// Re-export terminology configs
export { terminologyConfigs } from './types/workspace';
