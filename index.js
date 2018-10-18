const StatusDev = require('./status.js');
const Utils = require('./utils');
const MyIp = require('quick-local-ip');
const fs = require('fs');
const path = require('path');

// Duration (in ms) to wait before attempting to reconnect.
const CONNECT_INTERVAL = 2000;
const CHAIN_NAME = 'embark';
const NETWORK_NAME = 'embark';

var EmbarkStatus = function (embark) {
  this.networkId = 1337;
  this.embark = embark;
  this.events = this.embark.events;
  this.pluginConfig = this.embark.pluginConfig;
  this.deviceIp = this.pluginConfig.deviceIp;
  this.statusDev = new StatusDev({ip: this.deviceIp});
  this.logger = this.embark.logger;
  this.webServerConfig = {};
  this.blockchainConfig = {};
  this.networkIdDirectory = path.join(process.env.DAPP_PATH, '.embark', 'embark-status');
  this.networkIdPath = path.join(this.networkIdDirectory, 'networkId');

  this.events.on('config:load:webserver', webServerConfig => this.webServerConfig = webServerConfig);
  this.events.on('config:load:blockchain', blockchainConfig => this.blockchainConfig = blockchainConfig);
  this.events.request('config:cors:add', `http://${this.deviceIp}`);

  this.run = function () {
    // keep trying to connect to the status app if previous connections were unsuccessful
    this.events.once('web3Ready', (isReady) => {
      this.events.request('blockchain:networkId', networkId => {
        this.networkId = networkId;
        const connectIntervalId = setInterval(() => {
          this.connectStatus((err, result) => {
            if (err) return this.logger.error(err);
            clearInterval(connectIntervalId);
            this.openDapp(err => {
              if (err) this.logger.error(err);
            });
          });
        }, CONNECT_INTERVAL);
        //this.connectStatus();
        //this.openDapp();
      });
    });
    ;
  }

  this.openDapp = function (cb) {
    let dappHost = this.webServerConfig.host;
    if (dappHost === '0.0.0.0' || dappHost === 'localhost') {
      dappHost = MyIp.getLocalIP4();
    }

    const dappUrl = Utils.buildUrl('http', dappHost, this.webServerConfig.port) + '/';

    this.statusDev.openDapp(dappUrl, (err, result) => {
      if (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          return cb(`Failed to open ${this.pluginConfig.name} in the Status app. Is the Status app open?`);
        }
        else return cb(`Error opening ${this.pluginConfig.name} in the Status app: ${err.message}.`);
      }
      this.logger.info(`${this.pluginConfig.name} opened successfully.`);
      cb(null, result);
    });
  }

  this.getStatusNetworkId = function (cb) {
    fs.readFile(this.networkIdPath, cb);
  }
  this.setStatusNetworkId = function (networkId) {
    fs.mkdir(this.networkIdDirectory, _err => {
      fs.writeFile(this.networkIdPath, networkId, err => {
        if (err) {
          this.logger.error(`Error storing networkId in embark: ${err.message}`);
        }
      });
    });
  }

  this.connectToStatusNetwork = (statusNetworkId, cb) => {
    this.logger.info(`Connecting Status app to network ${statusNetworkId}...`)
    this.statusDev.connect(statusNetworkId, (err, _result) => {
      if (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          return cb(`Failed to connect to the Status network. Is the Status app open?`);
        }
        return cb(`Error while connecting to Status network ${statusNetworkId} in the Status app: ${err.message}.`);
      }
      this.logger.info(`Successfully connected to network ${statusNetworkId}.`);
      cb();
    });
  }

  this.addAndConnectStatusNetwork = function (cb) {
    // defined here because the configs have not been hydrated from the dapp when the plugin is instantiated
    const nodePort = this.blockchainConfig.proxy ? this.blockchainConfig.rpcPort + 10 : this.blockchainConfig.rpcPort;
    const nodeUrl = Utils.buildUrl('http', this.blockchainConfig.rpcHost, nodePort);
    const date = new Date().toString().replace('GMT+1100 (Australian Eastern Daylight Time)', '');
    const networkName = `${NETWORK_NAME} (${this.pluginConfig.name} ${date})`;

    this.logger.info(`Adding network '${networkName}' to Status...`);
    return this.statusDev.addNetwork(networkName, nodeUrl, CHAIN_NAME, this.networkId, (err, result) => {
      if (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          return cb('Failed to add a network to the Status app. Is the Status app open?');
        }
        else return cb(`Error while adding network ${nodeUrl} (name: ${CHAIN_NAME}, networkId: ${this.networkId}) to the Status App: ${err.message}.`);
      }
      if (!err && !result) {
        return cb(`Empty response from the Status app. Is it possible your phone is in standby or the Status app is in the background?`);
      }
      const statusNetworkId = result['network-id'];
      if (!statusNetworkId) {
        return cb(`Status app returned a bad response (no 'network-id' present), could not connect.`);
      }
      this.logger.info(`Network '${networkName}' added successfully.`);
      this.setStatusNetworkId(statusNetworkId);
      this.connectToStatusNetwork(statusNetworkId, cb);
    });
  }

  this.connectStatus = function (cb) {
    // if we have previously added a network, try to retrieve the stored networkid
    // and connect to that network
    this.getStatusNetworkId((err, existingNetworkId) => {
      if (existingNetworkId) {
        return this.connectToStatusNetwork(existingNetworkId.toString(), cb);
      }
      // otherwise, add a new network and connect to that network
      return this.addAndConnectStatusNetwork(cb);
    });
  }

  this.registerEvents = function () {
    this.embark.registerServiceCheck('Status', (cb) => {
      this.statusDev.ping((_err, state) => {
        const stateName = (!!state ? 'on' : 'off')
        cb({name: `Status.im (${this.deviceIp})`, status: stateName});
      });
    });

    this.embark.events.on('check:backOnline:Status', () => {
      this.logger.info("------------------")
      this.logger.info("Connected to Status.im mobile app!")
      this.logger.info("------------------")
    });

    this.embark.events.on('check:wentOffline:Status', () => {
      this.logger.error("------------------")
      this.logger.error("Couldn't connect or lost connection to Status.im mobile app...")
      this.logger.error("------------------")
    });
  }


  //this.registerEvents();
  this.run();


};



module.exports = EmbarkStatus;
