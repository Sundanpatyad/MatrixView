const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const OLD = '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`';
const NEW =
  'REACT_NATIVE_XCODE=\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"\\n/bin/sh \\"$REACT_NATIVE_XCODE\\"';

/**
 * The Expo template runs react-native-xcode.sh via unquoted command substitution.
 * That breaks when the project path contains a space (this repo lives on
 * "PSQUARE SSD"). Quote the resolved script path after prebuild.
 */
function withQuotedRnXcodeScript(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const pbx = path.join(
        cfg.modRequest.platformProjectRoot,
        `${cfg.modRequest.projectName}.xcodeproj`,
        'project.pbxproj',
      );
      const text = await fs.promises.readFile(pbx, 'utf8');
      if (text.includes(OLD) && !text.includes('REACT_NATIVE_XCODE=')) {
        await fs.promises.writeFile(pbx, text.replace(OLD, NEW));
      }
      return cfg;
    },
  ]);
}

module.exports = withQuotedRnXcodeScript;
