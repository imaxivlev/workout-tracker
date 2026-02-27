# Workflow & Collaboration

## Team Setup

This workout tracker app is being developed by **two AI agents working in turns**:
- **Kiro** (you're reading this)
- **Antigravity**

## Git Repository

- Remote: `https://github.com/imaxivlev/workout-tracker.git`
- Branch strategy: Always commit changes before switching agents

## Important Rules

1. **Always commit your changes to git** before finishing your session
2. Check git status before starting work to see what the other agent changed
3. Pull latest changes if working after the other agent
4. Write clear commit messages describing what was changed

## Typical Workflow

```cmd
# Check what changed
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Description of changes"

# Push to remote
git push origin main
```

## Project Context

This is a CrossFit/workout tracking application. Key files:
- `/public/workout-tracker/` - Main app files
- `/mockups/` - Design prototypes and references
- `/documentation/` - Requirements and planning docs
