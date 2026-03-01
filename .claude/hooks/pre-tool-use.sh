#!/usr/bin/env bash
set -euo pipefail

input="${CLAUDE_TOOL_INPUT:-}"

# Block common bypass attempts. Local hooks are convenience; CI is authority.
if [[ "$input" == *"--no-verify"* ]]; then
  echo "ERROR: --no-verify is forbidden. Quality gates are non-negotiable."
  exit 1
fi

if [[ "$input" == *"SKIP_CI"* ]]; then
  echo "ERROR: SKIP_CI is forbidden. Quality gates are non-negotiable."
  exit 1
fi

# Prevent weakening lint gates via ad-hoc flags.
if [[ "$input" == *"eslint "* && "$input" == *"--max-warnings"* ]]; then
  echo "ERROR: Do not modify ESLint flags. Use npm run lint."
  exit 1
fi

# Block editing quality config files. These define non-negotiable thresholds
# (complexity caps, coverage, architecture boundaries, formatting).
# Changes require explicit user approval outside of Claude Code.
tool="${CLAUDE_TOOL_NAME:-}"
protected_configs="eslint.config.mjs|vitest.config.ts|\.dependency-cruiser\.cjs|tsconfig\.json|tsconfig\.build\.json|\.prettierrc|cspell\.json"
if [[ "$tool" == "Edit" || "$tool" == "Write" ]]; then
  if echo "$input" | grep -qE "$protected_configs"; then
    echo "ERROR: Modifying quality config files (ESLint, Vitest, dependency-cruiser, tsconfig, Prettier, cspell) is forbidden."
    echo "These files define enforced quality thresholds. If a rule is wrong, discuss with the user."
    exit 1
  fi
fi
