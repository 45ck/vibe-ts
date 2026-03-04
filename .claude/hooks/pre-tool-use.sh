#!/usr/bin/env bash
set -euo pipefail

input="${CLAUDE_TOOL_INPUT:-}"

# Block bypass attempts
if [[ "$input" == *"--no-verify"* ]] || [[ "$input" == *"git commit -n"* ]]; then
  echo "ERROR: Commit bypass flags are forbidden. Quality gates are non-negotiable."
  exit 1
fi

if [[ "$input" == *"SKIP_CI"* ]] || [[ "$input" == *"[skip ci]"* ]]; then
  echo "ERROR: CI-skip patterns are forbidden. Quality gates are non-negotiable."
  exit 1
fi

# Block hook bypass environment overrides.
if [[ "$input" == *"HUSKY=0"* ]] || [[ "$input" == *"HUSKY_SKIP_HOOKS"* ]] || [[ "$input" == *"SKIP_CI="* ]]; then
  echo "ERROR: hook bypass environment variables are forbidden. Quality gates are non-negotiable."
  exit 1
fi

# Block direct hook-path disabling commands.
if [[ "$input" == *"core.hooksPath"* ]] || [[ "$input" == *" --no-verify "* ]] || [[ "$input" == *"-c core.hooksPath"* ]]; then
  echo "ERROR: Disabling hook execution via git core.hooksPath is forbidden."
  exit 1
fi

# Block explicit destructive push/reset commands that can bypass branch safety.
if [[ "$input" == *"git push --force"* ]] || [[ "$input" == *"git push --force-with-lease"* ]] || [[ "$input" == *"git push -f "* ]] || [[ "$input" == *"git push -f"* ]]; then
  echo "ERROR: Force push is forbidden. Use normal collaborative sync instead."
  exit 1
fi

if [[ "$input" == *"git reset --hard"* ]]; then
  echo "ERROR: git reset --hard is forbidden. Use safer history-preserving alternatives."
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
protected_configs="eslint\\.config\\.mjs|vitest\\.config\\.ts|\\.dependency-cruiser\\.cjs|tsconfig\\.json|tsconfig\\.build\\.json|tsconfig\\.base\\.json|\\.prettierrc|cspell\\.json"
protected_infra="\\.beads/hooks/|\\.github/workflows/|\\.claude/settings\\.json|\\.claude/hooks/"
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
