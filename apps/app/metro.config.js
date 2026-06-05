const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
  // pnpm hoists shared transitive deps (e.g. expo-modules-core) into the
  // virtual store's flat hoist dir; Metro must search it because
  // disableHierarchicalLookup prevents the normal upward node_modules walk.
  path.resolve(workspaceRoot, "node_modules/.pnpm/node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
