# PlexifyBID Development Workflow

## Viewing Changes (Push/Pull Cadence)
1. Code Droid pushes to GitHub after completing each component
2. Ken pulls and runs `npm run dev` locally to verify UI/UX
3. Feedback provided in chat → Code Droid iterates → push → repeat

## Branch Strategy
- Feature work: `feature/*` branches
- PRs merge to `develop`
- Never commit directly to `main`

## Monorepo Integrity Rules
- All packages internal (no `file:../` external references)
- Validation before push: `npm ci && npm run lint && npm run type-check && npm run build`
- Shared UI changes require: `cd plexify-shared-ui && npm run build`

## Iteration Cadence
- Push after each logical unit (1-2 hours max)
- Descriptive commit messages
- Tag demo-ready commits with `[DEMO]` prefix

## Session Start Checklist
1. Pull latest from working branch
2. Run `npm install` if dependencies changed
3. Reference this WORKFLOW.md
4. Confirm build passes before starting work
