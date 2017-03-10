var child = require('child_process');

module.exports = function(embark) {
  var getDAppData = function() {
    return {
      "whisper-identity": (embark.pluginConfig.whisperIdentity || "dapp-test"),
      "dapp-url": "http://" + embark.config.webServerConfig.host + ":" + embark.config.webServerConfig.port + "/",
      "name": (embark.pluginConfig.name || "My DApp")
    };
  };

  var statusAddDApp = function(dapp) {
    child.exec("./node_modules/.bin/status-dev-cli add-dapp " + JSON.stringify(dapp) + " --ip " + embark.pluginConfig.deviceIp);
  };

  var statusSwitchNode = function(node) {
    child.exec("./node_modules/.bin/status-dev-cli switch-node " + node + " --ip " + embark.pluginConfig.deviceIp);
  };

  var statusDAppChanged = function(dapp) {
    child.exec("./node_modules/.bin/status-dev-cli refresh-dapp " + JSON.stringify(dapp) + " --ip " + embark.pluginConfig.deviceIp);
  };

  embark.events.on("firstDeploymentDone", function() {
    statusSwitchNode("http://" + embark.config.blockchainConfig.rpcHost + ":" + embark.config.blockchainConfig.rpcPort);

    embark.logger.info("Adding DApp to Status");
    statusAddDApp(getDAppData());
  });


  // when the dapp is regenerated
  embark.events.on("outputDone", function() {
    statusDAppChanged(getDAppData());
  });
};
