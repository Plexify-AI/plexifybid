# PlexifyBID

**Business and Economic Development Management Platform for Business Improvement Districts**

PlexifyBID is a unified Business and Economic Development Management Platform for BID Executive Directors to manage:
- Business and Economic Development projects and initiatives 
- The overseeing of district operations (security, maintenance, events)
- Property owner assessments and collections
- Board reporting and stakeholder communications
- Capital project coordination

## Part of Plexify Suite

- **PlexifyAEC** - Construction BD platform (discover BID opportunities)
- **PlexifyBID** - BID Business and Economic Development platform (manage district BD projects) ← You are here
- **PlexifyBIZ** - Future district business BD platform

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Anthropic Claude API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Plexify-AI/plexifybid.git
cd plexifybid

# Install dependencies
npm install

# Copy environment file and add your API key
cp .env.example .env
# Edit .env and add your VITE_ANTHROPIC_API_KEY
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at `http://localhost:5173`

## Technology Stack

- **Frontend:** React 19+ with TypeScript
- **Build Tool:** Vite 7+
- **Styling:** TailwindCSS 3+
- **Routing:** React Router 7+
- **State Management:** Zustand
- **Icons:** Lucide React
- **AI Integration:** Anthropic Claude API (Ask Plexi assistant)

## Features

### Current Features
- Real-time operations dashboard
- Assessment management and tracking
- Board reporting and metrics
- Ask Plexi AI assistant for district insights
- Field coordinator management

### Coming Soon
- Mobile field operations app
- Automated board report generation
- Property owner portal
- Service request tracking

## Architecture

This application was cloned from PlexifyAEC on November 21, 2025, and rebranded for BID operations use cases. See `CLONE_NOTES.md` for details about the clone operation and lessons learned.

## Development Workflow

- **Main branch:** Stable production-ready code
- **Develop branch:** Integration branch for features
- **Feature branches:** `feature/feature-name` for new development

## Documentation

- `CLONE_NOTES.md` - Documentation about the clone from PlexifyAEC
- `HANDOFF_TO_CODE_DROID.md` - Instructions for Code Droid feature development
- `CLAUDE_API_SETUP.md` - Guide for setting up Claude API integration

## Contributing

This is a private repository for Plexify development. For questions or contributions, contact Ken D'Amato.

## License

Proprietary - Ken D'Amato / Plexify

## Contact

**Ken D'Amato**
Email: ken@plexify.io
Organization: Plexify AI

---

*PlexifyBID - Empowering Business Improvement Districts with intelligent operations management*
