const getStack = require('../node_modules/sam-launchpad/scripts/get-stack');
const exec = require('child_process').exec;
const getStackName = require('../util/get-stack-name');
const join = require('path').join;
const Logger = require('../lib/Logger/log')


// Hook script must return a promise
const syncAssets = (options) => {
  return new Promise(async(resolve, reject) => {
    Logger.info(["  DEPLOYING ASSETS TO S3:"]);

    const { args } = options;
    const appName = "";
    const stackName = getStackName(options, appName);
    const stack = await getStack(stackName);
    const projectPath = ".";
    const themesDirectory = join(__dirname, `../${projectPath}/themes`);
    const bucketName = stack.Outputs
      .find(data => data.OutputKey == "AssetsLogicAddress")
      .OutputValue;
    exec(`aws s3 sync ${themesDirectory} s3://${bucketName}/ --acl public-read --exclude "*.mustache"`,
      (error, stdout, stderr) => {
        if (error) {
          Logger.error(['Error syncing assets: ',stderr]);
          reject(stderr);
        }
        else {
          Logger.info(["  done."]);
          resolve();
        }
      }
    );

  });
}

module.exports = syncAssets;
