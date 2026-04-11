#!/bin/bash
# Pre-push hook: runs next build to catch errors before deploying to Vercel
# Exit 2 = block the push, Exit 0 = allow

cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "Running build check before push..." >&2
BUILD_OUTPUT=$(npx next build 2>&1)
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo "BUILD FAILED — fix errors before pushing:" >&2
  echo "$BUILD_OUTPUT" | tail -30 >&2
  exit 2
fi

echo "Build passed." >&2
exit 0
