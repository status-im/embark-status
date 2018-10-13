const StatusDev = require('./status.js');
let isConnected = false;

module.exports = function(embark) {
  const deviceIp = embark.pluginConfig.deviceIp;
  const statusDev = new StatusDev({ip: deviceIp});
  const chainName = 'embark';
  const networkId = 1337;

  embark.registerServiceCheck('Status', function (cb) {
    // defined here because embark.config has been hydrated from the dapp properly
    const dappUrl = `http://${embark.config.webServerConfig.host}:${embark.config.webServerConfig.port}/`;
    const nodeUrl = `http://${embark.config.webServerConfig.host}:8555`;
    
    statusDev.ping((err, state) => {
      const stateName = (!!state ? 'on' : 'off')
      cb({name: `Status.im (${deviceIp})`, status: stateName});

      // keep trying to connect to the status app if previous connections were unsuccessful
      if(!isConnected){
        statusDev.addNetwork('embark', nodeUrl, chainName, networkId, (err, result) => {
          if(err){
            return embark.logger.error('Error adding embark to the Status App: ' + err.message);
          }
          let statusNetworkId = result['network-id']
          statusDev.connect(statusNetworkId, (err, result) => {
            if(err){
              return embark.logger.error('Error while connecting embark to the Status App: ' + err.message);
            }
            isConnected = true; 
            statusDev.addDapp(dappUrl, (err, result) => {
              if(err){
                return embark.logger.error('Error adding your dApp to the Status App: ' + err.message);
              }
              embark.logger.info('you can now access your dapp on the status mobile app')
            });
          });
        });
      }
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
};
