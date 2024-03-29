const path = require('path');
const nodeAbi = require('node-abi');
const fs = require('fs');
const got = require('got');
const shelljs = require('shelljs');

const request = async (url, json = false) => new Promise(async (resolve, reject) => {
  try {
    const { body } = await got(url, {
      headers: {
        'User-Agent': 'ElectronForContruct',
      },
      json,
    });
    resolve(body);
  } catch (e) {
    reject(e);
  }
});

const downloadFile = async (url, mypath, logger) => new Promise((resolve) => {
  const stream = got.stream(url);
  stream
    .on('downloadProgress', progress => logger.log(`${Math.round(progress.percent * 100)}%`))
    .pipe(fs.createWriteStream(
      mypath,
    ))
    .on('finish', () => {
      resolve(got);
    });
});

/**
 * @type EFCModule
 */
module.exports = {
  name: 'greenworks',
  description: 'Configure greenworks',

  config: {
    steamId: 480,
    sdkPath: 'steam_sdk',
    localGreenworksPath: null,
  },

  /**
   * Command
   */

  async onPreBuild(args, settings, tmpdir) {
    const logger = this.Logger.interactive('greenworks');

    const greenworksDir = path.join(tmpdir, 'greenworks');
    const greenworksLibsDir = path.join(greenworksDir, 'lib');

    if (!settings.greenworks) {
      logger.error('"greenworks" key not found. You must specify your greenworks settings under this key.');
      return false;
    }

    if (!settings.greenworks.sdkPath) {
      logger.error('Please specify a path to your steam sdk in the configuration file');
      return false;
    }

    const { sdkPath } = settings.greenworks;

    if (!fs.existsSync(sdkPath)) {
      logger.error(`${sdkPath} does not exist! Please, specify a valid path to your steam sdk.`);
      return false;
    }

    // -----------------------///

    // Create greenworks directory
    logger.info('Generating required folders');

    if (!fs.existsSync(greenworksDir)) {
      shelljs.mkdir(greenworksDir);
    }
    if (!fs.existsSync(greenworksLibsDir)) {
      shelljs.mkdir(greenworksLibsDir);
    }

    // Generate steamId
    if (!settings.greenworks.steamId) {
      logger.error('Please specify a steam game id in the configuration file');
      return false;
    }

    const { steamId, localGreenworksPath, prebuildsVersion } = settings.greenworks;

    logger.info('Downloading greenworks');

    const steamAppIdPath = path.join(greenworksDir, 'steam_appid.txt');
    fs.writeFileSync(steamAppIdPath, steamId, 'utf8');

    // Download latest greenworks init
    const greenworksjsPath = path.join(greenworksDir, 'greenworks.js');
    const greenworksFileRemoteContent = await request('https://raw.githubusercontent.com/greenheartgames/greenworks/master/greenworks.js');
    fs.writeFileSync(greenworksjsPath, greenworksFileRemoteContent, 'utf8');

    logger.info('Copying files');
    const toCopy = [
      path.join(sdkPath, 'redistributable_bin', 'linux64', 'libsteam_api.so'),
      path.join(sdkPath, 'redistributable_bin', 'osx32', 'libsteam_api.dylib'),
      path.join(sdkPath, 'redistributable_bin', 'win64', 'steam_api64.dll'),
      path.join(sdkPath, 'redistributable_bin', 'steam_api.dll'),
      path.join(sdkPath, 'public', 'steam', 'lib', 'linux64', 'libsdkencryptedappticket.so'),
      path.join(sdkPath, 'public', 'steam', 'lib', 'osx32', 'libsdkencryptedappticket.dylib'),
      path.join(sdkPath, 'public', 'steam', 'lib', 'win32', 'sdkencryptedappticket.dll'),
      path.join(sdkPath, 'public', 'steam', 'lib', 'win64', 'sdkencryptedappticket64.dll'),
    ];

    for (let i = 0; i < toCopy.length; i += 1) {
      const file = toCopy[i];
      try {
        if (!fs.existsSync(path.join(greenworksLibsDir, path.basename(file)))) {
          shelljs.cp(file, greenworksLibsDir);
        }
      } catch (e) {
        logger.error(`There was an error copying ${file}, are you sure steam sdk path is valid ?`);
        return false;
      }
    }

    if (localGreenworksPath) {
      const localLibPath = path.join(localGreenworksPath, 'node_modules', 'greenworks', 'lib');
      if (fs.existsSync(localLibPath)) {
        logger.info(`Using local build from ${localLibPath}`);
        const files = fs.readdirSync(localLibPath);
        files.forEach((file) => {
          if (path.extname(file) === '.node') {
            shelljs.cp(path.join(localLibPath, file), greenworksLibsDir);
          }
        });
      } else {
        logger.error(`${localLibPath} can not be found!`);
        return false;
      }
    } else {
      const version = settings.electron;
      const abi = nodeAbi.getAbi(version, 'electron');

      if (version[0] === '4' && abi === '64') {
        logger.error(`Electron version ${version} found - aborting due to known ABI issue
More information about this issue can be found at https://github.com/lgeiger/node-abi/issues/54
Please, avoid using electron from 4.0.0 to 4.0.3`);
        throw new Error('Invalid Electron version');
      }

      logger.info('Fetching prebuilds');
      let release = 'latest';
      if (prebuildsVersion) {
        release = `tags/v${prebuildsVersion}`;
      }
      const url = `https://api.github.com/repos/ElectronForConstruct/greenworks-prebuilds/releases/${release}`;
      const content = await request(url, true);

      const platforms = ['darwin', 'win32', 'linux'];
      const platformsX = ['osx', 'win', 'linux'];

      const downloads = [];

      logger.info('Downloading prebuilds');
      for (let i = 0; i < platforms.length; i += 1) {
        const platform = platforms[i];

        const assetName = `greenworks-electron-v${abi}-${platform}-x64.node`;
        const asset = content.assets.find(a => a.name === assetName);
        if (!asset) {
          logger.error(`The target ${assetName} seems not to be available
          currently. Build it yourself, or change Electron version.`);
          return false;
        }
        const res = asset.browser_download_url;

        downloads.push(downloadFile(res, path.join(greenworksLibsDir, `greenworks-${platformsX[i]}64.node`), logger));
      }

      try {
        await Promise.all(downloads);
      } catch (e) {
        logger.error(e);
      }

      shelljs.rm('-rf', path.join(greenworksLibsDir, 'obj.target'));
    }

    logger.success('Initialization done!');
    return true;
  },

  async onPostBuild(args, settings, out) {
    const { steamId } = settings.greenworks;

    fs.writeFileSync(path.join(out, 'steam_appid.txt'), steamId, 'utf8');
    return true;
  },

  async run() {
    const logger = this.Logger.normal('greenworks');
    logger.info('Greenworks run automatically before the build step.');
  },
};
