# PlexifyBID Development Workflow

## AI-Assisted Development Stack

| Tool | Role | When to Use |
|------|------|-------------|
| Claude Sonnet | Strategy, specs, prompts | Planning sessions, PRD work |
| Code Droid (Factory.ai) | Frontend implementation | UI components, React work |
| Claude Code | Backend development | API endpoints, middleware, architecture |
| GitHub Desktop + VSCode | Local development | Manual edits, debugging, git operations |

## Claude Code Workflow

### Before Starting
1. Pull latest from develop
2. Confirm CLAUDE.md is present at repo root
3. Claude Code will read CLAUDE.md and follow its rules

### The Edit Cycle
branch → spec → review proposal → approve edits → test → PR

**Step 1: Create Feature Branch**
Create a new branch called feature/[description] from develop

**Step 2: Give a Clear Spec**
Include:
- What the feature should do
- Expected inputs/outputs
- Any patterns to follow
- End with: "Show me the approach before making changes"

**Step 3: Review Proposal**
Claude Code should:
- Explore existing code first
- Propose where changes will go
- Show code before writing
- Wait for explicit approval

If it skips this, say:
Stop. Show me the change before making it. That's in CLAUDE.md.

**Step 4: Approve Edits**
- Review each file change
- Choose "Yes" for single edit approval
- Only use "Yes to all" for trusted, low-risk sessions

**Step 5: Test Locally**
npm run dev
Verify the feature works before pushing.

**Step 6: Push and PR**
Push this branch and create a PR to merge into develop

## Commit Message Convention

Format: `[type]: brief description`

| Type | Use For |
|------|---------|
| feat | New feature |
| fix | Bug fix |
| refactor | Code restructure, no behavior change |
| docs | Documentation only |
| chore | Maintenance, dependencies |

Examples:
- `feat: add /api/health endpoint`
- `fix(security): add .env.procore to gitignore`
- `docs: add DEV_WORKFLOW.md`

## Safety Rules (from CLAUDE.md)

- Always work on feature branches
- Never push directly to develop or main
- Create backup branches before risky operations
- PRs required for merging
- No destructive operations without explicit approval

## Testing Checklist

Before creating a PR:
- [ ] Feature works locally
- [ ] No console errors
- [ ] Existing features still work
- [ ] Commit messages follow convention
