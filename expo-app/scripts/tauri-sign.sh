#!/bin/bash
# Ad-hoc code sign Tauri .app bundles and recreate DMG with signed app.
# This prevents macOS Gatekeeper "damaged" errors without Apple Developer certificate.
set -e

BUNDLE_DIR="src-tauri/target/release/bundle"
MACOS_DIR="$BUNDLE_DIR/macos"
DMG_DIR="$BUNDLE_DIR/dmg"

# Find and sign all .app bundles
for app in "$MACOS_DIR"/*.app; do
  [ -e "$app" ] || continue
  echo "Signing: $(basename "$app")"
  codesign --force --deep -s - "$app"
done

# Recreate DMG files with signed .app
for dmg in "$DMG_DIR"/*.dmg; do
  [ -e "$dmg" ] || continue

  dmg_name="$(basename "$dmg")"
  # Extract app name from DMG (e.g. "Happy_0.1.0_aarch64.dmg" -> "Happy")
  app_name="$(echo "$dmg_name" | sed 's/_[0-9].*//')"

  # Find matching .app by exact name first, then by prefix
  matched_app=""
  if [ -d "$MACOS_DIR/$app_name.app" ]; then
    matched_app="$MACOS_DIR/$app_name.app"
  else
    for app in "$MACOS_DIR"/*.app; do
      basename_no_ext="$(basename "$app" .app)"
      if [[ "$basename_no_ext" == "$app_name ("* ]]; then
        matched_app="$app"
        break
      fi
    done
  fi

  if [ -z "$matched_app" ]; then
    echo "Warning: No matching .app found for $dmg_name, skipping DMG rebuild"
    continue
  fi

  echo "Rebuilding DMG: $dmg_name (with signed $(basename "$matched_app"))"

  # Create temp directory with the signed .app
  tmp_dir=$(mktemp -d)
  cp -R "$matched_app" "$tmp_dir/"

  # Remove old DMG and create new one
  rm -f "$dmg"
  hdiutil create -volname "$app_name" -srcfolder "$tmp_dir" -ov -format UDZO "$dmg"

  rm -rf "$tmp_dir"
done

echo "Ad-hoc signing and DMG rebuild complete."
