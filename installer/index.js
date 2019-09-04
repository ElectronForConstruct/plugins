const path = require('path');
const eb   = require('electron-builder/out/index');

/**
 * @type EFCModule
 */
module.exports = {
  name       : 'installer',
  description: 'Generate installer',
  config     : {
    appId: 'com.you.yourapp',

    asar: false,

    productName: 'YourAppName',
    copyright  : 'Copyright © 2018 You',
    directories: {
      buildResources: 'build',
      output        : 'installers',
    },
    files      : [
      '!preview.exe',
      '!preview',
      '!node_modules/greenworks/!**',
      '!node_modules/app-builder-bin/!**',
      '!node_modules/app-builder-lib/!**',
    ],
    publish    : [],
  },

  async run(args, settings) {
    const { postBuild, preBuild, postInstaller, setupDir, prettyDisplayFolders } = this.Utils;
    const logger = this.Logger.normal('installer')

    const packOptions = settings.installer;


    if (settings.electron) {
      packOptions.electronVersion = settings.electron;
    }

    // setup directories
    const zipFile = args.zip ? args.zip : null;
    const tempDir = await setupDir(settings, zipFile, 'build');

    packOptions.afterPack = async (context) => {
      await postBuild(this.modules, args, settings, [ context.appOutDir ]);
    };

    packOptions.directories.app = tempDir;

    if (!path.isAbsolute(packOptions.directories.output)) {
      packOptions.directories.output = path.join(process.cwd(), packOptions.directories.output);
    }
    if (!path.isAbsolute(packOptions.directories.app)) {
      packOptions.directories.app = path.join(process.cwd(), packOptions.directories.app);
    }
    if (!path.isAbsolute(packOptions.directories.buildResources)) {
      packOptions.directories.buildResources = path.join(
        process.cwd(),
        packOptions.directories.buildResources,
      );
    }

    await preBuild(this.modules, args, settings, tempDir);

    try {
      const appPaths = await eb.build({ config: packOptions });

      logger.success('Files packed successfuly!');
      prettyDisplayFolders(appPaths.filter(p => !p.includes('blockmap')));

      postInstaller(this.modules, args, settings, path.dirname(appPaths[ 0 ]));
    } catch (e) {
      logger.log('There was an error building your project:', e);
    }
  },
};
