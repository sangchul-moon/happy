#!/bin/bash
# Bump the expo-app version in both package.json and tauri.conf.json
# Usage: bash scripts/bump-version.sh [major|minor|patch]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$SCRIPT_DIR/package.json"
TAURI="$SCRIPT_DIR/src-tauri/tauri.conf.json"

# Read current version from package.json
CURRENT=$(grep -o '"version": "[^"]*"' "$PKG" | head -1 | cut -d'"' -f4)

if [ -z "$CURRENT" ]; then
  echo "Error: Could not read current version from package.json"
  exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

BUMP_TYPE="${1:-patch}"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Usage: $0 [major|minor|patch]"
    exit 1
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$PKG"

# Update tauri.conf.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$TAURI"

echo "$CURRENT -> $NEW_VERSION"
