# vibe-ts

> Generated from `docs/src/README-001.toon`

- **id**: README-001
- **kind**: README
- **status**: accepted
- **scope**: platform
- **owner**: Engineering
- **date**: 2026-03-04
- **tags**: template, quality, ai-assist

## Sections

### Overview

Quality-first TypeScript template for AI-assisted development. DDD architecture with enforced boundaries and mutation testing.

### Quick setup

1. Use this template repository.
2. Install from this repo in one step:
   - `npx --yes --package git+https://github.com/45ck/vibe-ts.git vibe-ts <new-project-directory> --name <project-name>`
   - `npx --yes --package git+https://github.com/45ck/vibe-ts.git vibe-ts <new-project-directory> --name <project-name> --scope <scope>`
3. Or run locally from this repo:
   - `npm run template:create -- <new-project-directory> --name <project-name>`.
4. Enter the new folder and run `npm install` if not already completed by the bootstrap step.
5. Replace remaining template references with your project-specific metadata.
6. Run `npm run ci` before merging.
7. Remove sample domain/application/infrastructure files.

### Architecture

The repo is organized by domain layers with enforced dependencies:
`src/domain`, `src/application`, `src/infrastructure`, `src/presentation` in generated templates.
Domain has zero external dependencies except shared foundations.

### Quality gates

Use `npm run ci` for full checks and `npm run quality` for noslop gates and mutation checks.

### Documentation workflow

Edit sources in `docs/src/*.toon`, then run `npm run docs:generate` to update generated Markdown docs.

### Documentation outputs

Generated Markdown artifacts land in `docs/` and root files `README.md`, `CLAUDE.md`, and `AGENTS.md`.
