# Plexify Shared UI Components

Shared React component library for PlexifyAEC, PlexifyBID, and PlexifyBIZ.

## Overview

This package provides theme-agnostic UI components that adapt to each Plexify product's branding:
- **PlexifyAEC**: Purple theme for Construction BD
- **PlexifyBID**: Navy blue theme for BID Directors
- **PlexifyBIZ**: Slate-to-copper gradient theme for Business Owners

## Installation

### For Local Development (npm link)
```bash
# In plexify-shared-ui/
npm install
npm run build
npm link

# In your app (plexifyaec, plexifybid, plexifybiz)
npm link plexify-shared-ui
```

### For Production (npm package)
```bash
npm install plexify-shared-ui
```

## Components

### Report Editor Workspace

AI-powered report editing workspace with 3-column layout.

**Features:**
- Left Panel: Audio/video sources and draggable source materials
- Center Panel: Rich text block editor with AI regeneration
- Right Panel: AI research assistant chat interface

**Usage:**
```typescript
import { ReportEditorWorkspace, PlexifyTheme } from 'plexify-shared-ui';

const myTheme: PlexifyTheme = {
  name: 'bid',
  primaryColor: '#1e3a8a',
  secondaryColor: '#3b82f6',
  accentColor: '#10b981',
  gradientStart: '#1e3a8a',
  gradientEnd: '#1e3a8a',
  sidebarColor: '#1e3a8a',
};

function MyPage() {
  return (
    <ReportEditorWorkspace
      projectId="project-123"
      isOpen={true}
      onClose={() => console.log('Closed')}
      theme={myTheme}
      terminology="bid"
    />
  );
}
```

### Individual Components

All workspace components can be used independently:

```typescript
import {
  AudioBriefingCard,
  VideoSummaryCard,
  SourceMaterialsList,
  BlockEditor,
  EditorToolbar,
  RegenerateWithAIButton,
  AIAssistantPanel,
  AIMessageBubble,
} from 'plexify-shared-ui';
```

## Theme Configuration

Each Plexify product defines its own theme:

### PlexifyAEC (Purple)
```typescript
import { aecTheme } from 'plexify-shared-ui';

// Or define custom:
export const aecTheme: PlexifyTheme = {
  name: 'aec',
  primaryColor: '#7c3aed',
  secondaryColor: '#a78bfa',
  accentColor: '#10b981',
  gradientStart: '#7c3aed',
  gradientEnd: '#7c3aed',
  sidebarColor: '#7c3aed',
};
```

### PlexifyBID (Navy Blue)
```typescript
import { bidTheme } from 'plexify-shared-ui';

// Or define custom:
export const bidTheme: PlexifyTheme = {
  name: 'bid',
  primaryColor: '#1e3a8a',
  secondaryColor: '#3b82f6',
  accentColor: '#10b981',
  gradientStart: '#1e3a8a',
  gradientEnd: '#1e3a8a',
  sidebarColor: '#1e3a8a',
};
```

### PlexifyBIZ (Slate-to-Copper Gradient)
```typescript
import { bizTheme } from 'plexify-shared-ui';

// Or define custom:
export const bizTheme: PlexifyTheme = {
  name: 'biz',
  primaryColor: '#353c56',
  secondaryColor: '#d79973',
  accentColor: '#d97706',
  gradientStart: '#353c56',
  gradientEnd: '#d79973',
  sidebarColor: '#7c3aed',
};
```

## Terminology Sets

Components can adapt their labels based on product context:

- **'construction'**: For PlexifyAEC (e.g., "Proposal" instead of "Report")
- **'bid'**: For PlexifyBID (e.g., "Board Report")
- **'business'**: For PlexifyBIZ (e.g., "Compliance Report")

```typescript
import { terminologyConfigs } from 'plexify-shared-ui';

// Access terminology:
const config = terminologyConfigs['bid'];
console.log(config.reportTitle); // "Board Report"
console.log(config.regenerateButton); // "Regenerate Report"
console.log(config.aiAssistantName); // "Plexify AI - BID Assistant"
console.log(config.sourceMaterialsLabel); // "Source Materials"
```

## State Management

Use the included Zustand store for workspace state:

```typescript
import { useWorkspaceStore } from 'plexify-shared-ui';

function MyComponent() {
  const {
    content,
    setContent,
    messages,
    addMessage,
    sourceMaterials,
    isWorkspaceOpen,
    openWorkspace,
    closeWorkspace,
  } = useWorkspaceStore();

  // Use state and actions...
}
```

## Export Utilities

Export reports to PDF or PowerPoint:

```typescript
import { exportReportToPDF, exportReportToPPTX } from 'plexify-shared-ui';

// Export to PDF
await exportReportToPDF(content, 'my-report.pdf', {
  title: 'Board Report',
  author: 'Plexify AI',
  theme: bidTheme,
});

// Export to PowerPoint
await exportReportToPPTX(content, 'Project Name', {
  title: 'Board Report',
  theme: bidTheme,
});
```

## Development

```bash
# Install dependencies
npm install

# Build in watch mode (for development)
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

## Peer Dependencies

This package requires the following peer dependencies (provided by your app):

- react ^19.0.0
- react-dom ^19.0.0
- @tiptap/react ^2.1.0
- @tiptap/starter-kit ^2.1.0
- @tiptap/extension-placeholder ^2.1.0
- zustand ^4.4.0
- @dnd-kit/core ^6.1.0
- @dnd-kit/sortable ^8.0.0
- @dnd-kit/utilities ^3.2.0
- react-h5-audio-player ^3.9.0

## Architecture

**Tech Stack:**
- React 19 for UI components
- TypeScript for type safety
- Zustand for state management
- TipTap for rich text editing
- dnd-kit for drag and drop
- Vite for building

**Design Principles:**
- Theme-agnostic components
- Dependency injection via props
- Type-safe interfaces
- Zero hardcoded colors or branding

## Project Structure

```
plexify-shared-ui/
├── src/
│   ├── components/
│   │   └── workspace/
│   │       ├── ReportEditorWorkspace.tsx
│   │       ├── AudioBriefingCard.tsx
│   │       ├── VideoSummaryCard.tsx
│   │       ├── SourceMaterialsList.tsx
│   │       ├── BlockEditor.tsx
│   │       ├── EditorToolbar.tsx
│   │       ├── RegenerateWithAIButton.tsx
│   │       ├── AIAssistantPanel.tsx
│   │       ├── AIMessageBubble.tsx
│   │       └── index.ts
│   ├── stores/
│   │   ├── workspaceStore.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── exportToPDF.ts
│   │   ├── exportToPPTX.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── theme.ts
│   │   ├── workspace.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── README.md
```

## Contributing

When adding new shared components:

1. Create component in `src/components/`
2. Accept `theme: PlexifyTheme` prop for all colors
3. Use relative imports (no `@/` aliases)
4. Export from appropriate index.ts
5. Add usage example to this README
6. Rebuild: `npm run build`
7. Test in all 3 products (AEC, BID, BIZ)

## API Reference

### PlexifyTheme Interface

```typescript
interface PlexifyTheme {
  name: 'aec' | 'bid' | 'biz';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gradientStart: string;
  gradientEnd: string;
  sidebarColor: string;
  sidebarHoverColor?: string;
  sidebarActiveColor?: string;
  textPrimary?: string;
  textSecondary?: string;
  textInverse?: string;
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
}
```

### ReportEditorWorkspaceProps

```typescript
interface ReportEditorWorkspaceProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  theme: PlexifyTheme;
  terminology?: TerminologySet;
  config?: WorkspaceConfig;
  initialContent?: string;
  sourceMaterials?: SourceMaterial[];
  audioUrl?: string;
  audioDuration?: string;
  audioChapters?: AudioChapter[];
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: string;
  onSave?: (content: string) => Promise<void>;
  onRegenerate?: (instructions?: string) => Promise<string>;
  onAIMessage?: (message: string) => Promise<Message>;
  onExportPDF?: () => Promise<void>;
  onExportPPTX?: () => Promise<void>;
}
```

## Version History

**v1.0.0** - Initial release
- Report Editor Workspace
- Audio/Video components
- AI Assistant Panel
- Export utilities (PDF/PowerPoint)
- Zustand store for workspace state
- Full TypeScript support

## License

MIT License - Plexify AI

## Support

For issues or questions: ken@plexify.ai
