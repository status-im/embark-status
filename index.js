var Status = require('./status-dev.js');

module.exports = function(embark) {
  var status = new Status(embark.pluginConfig.deviceIp);

  var dappData = function() {
    return {
      "whisper-identity": (embark.pluginConfig.whisperIdentity || "dapp-test"),
      "dapp-url": "http://" + embark.config.webServerConfig.host + ":" + embark.config.webServerConfig.port + "/",
      "name": (embark.pluginConfig.name || "My Dapp")
    };
  };

  embark.events.on("firstDeploymentDone", function() {
    status.switchNodes("http://" + embark.config.blockchainConfig.rpcHost + ":" + embark.config.blockchainConfig.rpcPort);

    embark.logger.info("adding Dapp to Status");
    status.addDapp(dappData());
  });

  // when the dapp is regenerated
  embark.events.on("outputDone", function() {
    status.changeDapp(dappData());
  });
};
