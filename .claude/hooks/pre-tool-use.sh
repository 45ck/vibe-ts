#!/usr/bin/env bash
set -euo pipefail

input="${CLAUDE_TOOL_INPUT:-}"

# Block bypass attempts
if [[ "$input" == *"--no-verify"* ]]; then
  echo "ERROR: --no-verify is forbidden. Quality gates are non-negotiable."
  exit 1
fi

if [[ "$input" == *"SKIP_CI"* ]] || [[ "$input" == *"[skip ci]"* ]]; then
  echo "ERROR: CI-skip patterns are forbidden. Quality gates are non-negotiable."
  exit 1
fi

# Block ad-hoc eslint invocations that bypass the npm run lint wrapper.
# All linting must go through: npm run lint or npm run lint:fix
if [[ "$input" =~ (^|[[:space:]])eslint([[:space:]]|$) ]]; then
  echo "ERROR: Run 'npm run lint' or 'npm run lint:fix' instead of a direct eslint invocation."
  exit 1
fi

# Block editing protected files
tool="${CLAUDE_TOOL_NAME:-}"
protected_configs="eslint\.config\.mjs|vitest\.config\.ts|\.dependency-cruiser\.cjs|tsconfig\.json|tsconfig\.build\.json|\.prettierrc|cspell\.json"
protected_infra="\.beads/hooks/|\.github/workflows/|\.claude/settings\.json|\.claude/hooks/"
if [[ "$tool" == "Edit" || "$tool" == "Write" ]]; then
  if echo "$input" | grep -qE "$protected_configs"; then
    echo "ERROR: Modifying quality config files (ESLint, Vitest, dependency-cruiser, tsconfig, Prettier, cspell) is forbidden."
    echo "These files define enforced quality thresholds. If a rule is wrong, discuss with the user."
    exit 1
  fi
  if echo "$input" | grep -qE "$protected_infra"; then
    echo "ERROR: Modifying hooks, CI workflows, or Claude settings is forbidden."
    echo "These files define the enforcement layer. Changes require explicit user approval."
    exit 1
  fi
fi
