/**
 * @type EFCModule
 */
module.exports = {
  name: 'crash-reporter',
  description: 'Configure crash reporter',

  onPreBuild(args, settings) {
    const logger = this.Logger.normal('crash-reporter');
    const crashReporter = settings['crash-reporter'];
    if (!crashReporter.enable) {
      logger.info('crash reporter is not enabled.');
      return;
    }

    if (!crashReporter.companyName || !crashReporter.submitURL) {
      throw new Error('"crash-reporter.companyName" and "crash-reporter.submitURL" are required in order to enable the crash reporter');
    }
  },

  async run() {
    const logger = this.Logger.normal('crash-reporter');
    logger.info('Please, see https://efc.armaldio.xyz/plugins/crash-reporter.html for information on how to configure this plugin');
  },
};
