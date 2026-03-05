const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Monorepo root
const monorepoRoot = path.resolve(__dirname, "..");

const config = getDefaultConfig(__dirname, {
  // Enable CSS support for web
  isCSSEnabled: true,
});

// Monorepo support: watch folders and node_modules paths
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Add support for .wasm files (required by Skia for all platforms)
// Source: https://shopify.github.io/react-native-skia/docs/getting-started/installation/
config.resolver.assetExts.push('wasm');

// Force libsodium packages to use CommonJS version for web builds
// The ESM versions have compatibility issues with Metro bundler
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.includes('libsodium')) {
    // Redirect ESM imports to CommonJS
    if (moduleName === 'libsodium-wrappers') {
      return {
        filePath: path.resolve(monorepoRoot, 'node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js'),
        type: 'sourceFile',
      };
    }
  }
  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Enable inlineRequires for proper Skia and Reanimated loading
// Source: https://shopify.github.io/react-native-skia/docs/getting-started/web/
// Without this, Skia throws "react-native-reanimated is not installed" error
// This is cross-platform compatible (iOS, Android, web)
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true, // Critical for @shopify/react-native-skia
  },
});

module.exports = config;