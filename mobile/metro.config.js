const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// This checkout uses separate installs rather than npm workspaces. Watch only
// the dependency-free shared DTO folder outside the app root.
config.watchFolders = [path.resolve(__dirname, '../shared')];
module.exports = config;
