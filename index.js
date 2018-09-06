var StatusDev = require('./status.js');

var isConnected = false;

module.exports = function(embark) {
  let deviceIp = embark.pluginConfig.deviceIp;
  let statusDev = new StatusDev({ip: deviceIp});

  embark.registerServiceCheck('Status', function (cb) {
    statusDev.ping((err, state) => {
      cb({name: `Status.im (${deviceIp})`, status: !!state});
    });
  });

  let dappUrl = `http://${embark.config.webServerConfig.host}:${embark.config.webServerConfig.port}/`;
  let nodeUrl = `http://localhost:8545/`;
  let chainName = 'embark';
  let networkId = 1337;

	statusDev.addNetwork('embark', nodeUrl, chainName, networkId, (err, result) => {
    let statusNetworkId = result['network-id']
		statusDev.connect(statusNetworkId, (err, result) => {
			isConnected = true;
		  statusDev.addDapp(dappUrl, (err, result) => {
		  });
		});
	});

  //embark.events.on("outputDone", function() {
  //});
};
