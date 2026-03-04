# Beads - AI-Native Issue Tracking

This repository uses **Beads** for issue tracking -- a modern, AI-native tool designed to live directly in your codebase alongside your code.

## What is Beads?

Beads is issue tracking that lives in your repo, making it perfect for AI coding agents and developers who want their issues close to their code. No web UI required -- everything works through the CLI and integrates seamlessly with git.

**Learn more:** [github.com/steveyegge/beads](https://github.com/steveyegge/beads)

## Quick Start

```bash
# Create new issues
npm run bd -- issue create --title "Add user authentication"

# View all open issues
npm run bd -- issue list --open

# View issue details
npm run bd -- issue view bead-0001

# Show unblocked issues sorted by priority
npm run bd -- issue next --json

# Claim + create worktree for parallel work
npm run bd -- issue start bead-0001 --by "agent-alpha"

# Finish: merge + close (from repo root)
npm run bd -- issue finish bead-0001
```

### AI agent team bootstrap

```bash
# Seed a planned backlog from the template plan
npm run agent:seed-issues

# Inspect current project and issue context
npm run agent:context

# Spawn/assign an agent squad
npm run agent:spawn -- --agents "agent-alpha,agent-beta,agent-gamma"
```

It auto-creates worktrees and claims issues immediately by default.
Use `--no-assign` to print only the commands for manual startup.

## Why Beads?

- **AI-Native**: CLI-first design works seamlessly with AI coding agents
- **Git-Native**: Issues stored in `.beads/issues.jsonl`, committed with code
- **Parallel-Safe**: Worktree-based workflow supports multiple agents working simultaneously
- **Zero Config**: Works offline, syncs when you push

## Learn More

- **Documentation**: [github.com/steveyegge/beads](https://github.com/steveyegge/beads)
- **Agent Workflow**: See `AGENT_LOOP.md` in the repo root
