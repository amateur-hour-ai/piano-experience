#!/bin/bash
# Pre-commit hook: checks if app/ files changed but docs weren't updated
# Exit 2 = block the commit, Exit 0 = allow

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Check staged files
STAGED=$(git diff --cached --name-only 2>/dev/null)

# If any app/ files are staged (excluding docs page itself)
APP_CHANGES=$(echo "$STAGED" | grep -E '^app/' | grep -v 'app/docs/page.js' || true)
DOCS_CHANGED=$(echo "$STAGED" | grep 'app/docs/page.js' || true)

# If there are app/ changes but no docs update, warn
if [ -n "$APP_CHANGES" ] && [ -z "$DOCS_CHANGED" ]; then
  echo "WARNING: app/ files changed but app/docs/page.js was not updated." >&2
  echo "User requires docs/release notes updated with every user-facing change." >&2
  echo "Staged app changes:" >&2
  echo "$APP_CHANGES" >&2
  exit 2
fi

exit 0
