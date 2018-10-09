var StatusDev = require('./status.js');

var isConnected = false;

module.exports = function(embark) {
  let deviceIp = embark.pluginConfig.deviceIp;
  let statusDev = new StatusDev({ip: deviceIp});

  embark.registerServiceCheck('Status', function (cb) {
    statusDev.ping((err, state) => {
      let stateName = (!!state ? 'on' : 'off')
      cb({name: `Status.im (${deviceIp})`, status: stateName});
    });
  });

  embark.events.on('check:backOnline:Status', function () {
    embark.logger.info("------------------")
    embark.logger.info("Connected to Status.im mobile app!")
    embark.logger.info("------------------")
  });

  embark.events.on('check:wentOffline:Status', function () {
    embark.logger.error("------------------")
    embark.logger.error("couldn't connect or lost connection to Status.im mobile app...")
    embark.logger.error("------------------")
  });

  let dappUrl = `http://${embark.config.webServerConfig.host}:${embark.config.webServerConfig.port}/`;
  let nodeUrl = `http://${embark.config.webServerConfig.host}:8555`;
  let chainName = 'embark';
  let networkId = 1337;

  embark.events.on("outputDone", function() {
    statusDev.addNetwork('embark', nodeUrl, chainName, networkId, (err, result) => {
      let statusNetworkId = result['network-id']
      statusDev.connect(statusNetworkId, (err, result) => {
        isConnected = true;
        statusDev.addDapp(dappUrl, (err, result) => {
          embark.logger.info('you can now access your dapp on the status mobile app')
        });
      });
    });
  });
};
