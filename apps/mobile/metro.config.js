const { getDefaultConfig } = require('expo/metro-config');

/** Expo configures npm workspace resolution. Do not override watchFolders here. */
const config = getDefaultConfig(__dirname);

module.exports = config;
