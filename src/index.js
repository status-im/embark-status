import StatusApi from './statusApi.js';
import {buildUrl} from './utils';
const Ip = require('ip');
const fs = require('fs');
const path = require('path');

// Duration (in ms) to wait before attempting to reconnect.
const CONNECT_INTERVAL = 4000;
const CHAIN_NAME = 'embark';
const NETWORK_NAME = 'Embark';

// private method symbols
const _connectStatus = Symbol('connectStatus');
const _connectToStatusNetwork = Symbol('connectToStatusNetwork');
const _addAndConnectStatusNetwork = Symbol('addAndConnectStatusNetwork');
const _getStatusNetworkId = Symbol('getStatusNetworkId');
const _setStatusNetworkId = Symbol('setStatusNetworkId');
const _registerEvents = Symbol('registerEvents');

/**
 * Plugin that connects an Embark dApp to the Status app, and allows the dApp
 * to be run in the Status browser.
 */
class EmbarkStatusPlugin {
  constructor(embark) {
    this.networkId = 1337;
    this.embark = embark;
    this.events = this.embark.events;
    this.pluginConfig = this.embark.pluginConfig;
    this.deviceIp = this.pluginConfig.deviceIp;
    this.logger = this.embark.logger;
    // we want a timeout to occur before issuing the next request, so reduce the timeout specified
    this.statusApi = new StatusApi({ip: this.deviceIp, logger: this.logger, timeout: CONNECT_INTERVAL - 1000});
    this.webServerConfig = {};
    this.blockchainConfig = {};
    this.networkIdDirectory = path.join(process.env.DAPP_PATH, '.embark', 'embark-status');
    this.networkIdPath = path.join(this.networkIdDirectory, 'networkId');

    // gets hydrated webserver config from embark
    this.events.on('config:load:webserver', webServerConfig => {
      this.webServerConfig = webServerConfig;
    });

    // gets hydrated blockchain config from embark
    this.events.on('config:load:blockchain', blockchainConfig => {
      this.blockchainConfig = blockchainConfig;
    });

    // adds cors to blockchain and storage clients
    this.events.request('config:cors:add', `http://${this.deviceIp}`);

    // register service check
    this[_registerEvents]();

    // kick off network connection, and open dapp after connection
    this.connectStatusToEmbark();
  }

  /**
   * Continuously attempts to connect to the Status app by instructing
   * the Status app to connect to this dApp's network (node) until a 
   * successful connection is made. If the network doesn't exist, it is
   * added. Once a connection is made, the Status app is instructed to
   * open this dApp in it's dApp browser.
   * 
   * @returns {void}
   */
  connectStatusToEmbark() {
    // keep trying to connect to the status app if previous connections were unsuccessful
    this.events.once('web3Ready', (_isReady) => {
      this.events.request('blockchain:networkId', networkId => {
        this.networkId = networkId;
        const connectIntervalId = setInterval(() => {
          this[_connectStatus](err => {
            if (err) return this.logger.error(err);
            clearInterval(connectIntervalId);
            this.openDapp(err => {
              if (err) this.logger.error(err);
            });
          });
        }, CONNECT_INTERVAL);
      });
    });
  }

  /**
   * Opens the Embark dApp in the Status dApp browser.
   * 
   * @param {Function} cb Callback called after the open dApp command is sent 
   * to the Status app, called with parameters:
   *  - {String} err Error that occurred opening the dApp in the Status
   *                 browser.
   *  - {Object} result Result returned from the Status app on successful 
   *             opening of the dApp.
   * 
   * @returns {void}
   */
  openDapp(cb) {
    let dappHost = this.webServerConfig.host;
    if (dappHost === '0.0.0.0' || dappHost === 'localhost') {
      dappHost = Ip.address();
    }

    const dappUrl = this.pluginConfig.dappUrl || buildUrl('http', dappHost, this.webServerConfig.port) + '/';

    this.logger.info(`Opening ${this.pluginConfig.name} (${dappUrl}) in the Status browser...`);
    this.statusApi.openDapp(dappUrl, (err, result) => {
      if (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          return cb(`Failed to open ${this.pluginConfig.name} in the Status app. Is the Status app open?`);
        }
        return cb(`Error opening ${this.pluginConfig.name} in the Status app: ${err.message}.`);
      }
      this.logger.info(`${this.pluginConfig.name} opened successfully.`);
      cb(null, result);
    });
  }

  /**
   * Connects the Status app to an Embark network (node running in this dApp).
   * If the network doesn't exist, it is added. Network (node) settings are 
   * taken from the dApp's blockchain config rpcHost and rpcPort. CORS for the
   * device IP are setup automatically.
   * @private
   * 
   * @param {Function} cb Callback called after the connect to network command 
   * is sent to the Status app, called with parameters:
   *  - {String} err Error that occurred connecting the Status app to the 
   *             network.
   *  - {Object} result Result returned from the Status app on successful 
   *             connection to the Embark network.
   * 
   * @returns {void}
   */
  [_connectStatus](cb) {
    // if we have previously added a network, try to retrieve the stored networkid
    // and connect to that network
    this[_getStatusNetworkId]((_err, existingNetworkId) => {
      // ignore err and continue - most likely due to file not existing
      if (existingNetworkId) {
        return this[_connectToStatusNetwork](existingNetworkId.toString(), cb);
      }
      // otherwise, add a new network and connect to that network
      return this[_addAndConnectStatusNetwork](cb);
    });
  }

  /**
   * Connects the Status app to a network specified by the `statusNetworkId`
   * parameter.
   * @private
   * 
   * @param {String} statusNetworkId ID that identifies the network in the Status 
   * app to connect to.
   * @param {Function} cb Callback called after the connect to network command 
   * is sent to the Status app, called with parameters:
   *  - {String} err Error that occurred connecting the Status app to the
   *             network.
   *  - {Object} result Result returned from the Status app on successful 
   *             connection to the Embark network.
   * 
   * @returns {void}
   */
  [_connectToStatusNetwork](statusNetworkId, cb) {
    this.logger.info(`Connecting Status app to network ${statusNetworkId}...`);
    this.statusApi.connect(statusNetworkId, (err, result) => {
      if (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          return cb(`Failed to connect to the Status network. Is the Status app open?`);
        }
        return cb(`Error while connecting to Status network ${statusNetworkId} in the Status app: ${err.message}.`);
      }
      this.logger.info(`Successfully connected to network ${statusNetworkId}.`);
      cb(null, result);
    });
  }

  /**
   * Adds a network to the Status app, then attempts to connect to it. Upon a
   * successful addition of the network, the Status app will return a network ID,
   * which is stored in the dApp's temporary filesystem to prevent future additions
   * of an already exist network in the Status app.
   * @private
   * 
   * @param {*} cb Callback called after the connect to network command 
   * is sent to the Status app, called with parameters:
   *  - {String} err Error that occurred adding and connecting a network.
   *  - {Object} result Result returned from the Status app on successful 
   *             connection to the Embark network.
   * 
   * @returns {void}
   */
  [_addAndConnectStatusNetwork](cb) {
    // defined here because the configs have not been hydrated from the dapp when the plugin is instantiated
    const nodePort = this.blockchainConfig.proxy ? this.blockchainConfig.rpcPort + 10 : this.blockchainConfig.rpcPort;
    const nodeUrl = buildUrl('http', this.blockchainConfig.rpcHost, nodePort);
    const networkName = `${NETWORK_NAME} (${this.pluginConfig.name})`;

    this.logger.info(`Adding network '${networkName}' to Status...`);
    return this.statusApi.addNetwork(networkName, nodeUrl, CHAIN_NAME, this.networkId, (err, result) => {
      if (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          return cb('Failed to add a network to the Status app. Is the Status app open?');
        }
        return cb(`Error while adding network ${nodeUrl} (name: ${CHAIN_NAME}, networkId: ${this.networkId}) to the Status App: ${err.message}.`);
      }
      if (!err && !result) {
        return cb(`Empty response from the Status app. Is it possible your phone is in standby or the Status app is in the background?`);
      }
      const statusNetworkId = result['network-id'];
      if (!statusNetworkId) {
        return cb(`Status app returned a bad response (no 'network-id' present), could not connect.`);
      }
      this.logger.info(`Network '${networkName}' added successfully.`);
      this[_setStatusNetworkId](statusNetworkId);
      this[_connectToStatusNetwork](statusNetworkId, cb);
    });
  }

  /**
   * Retrieves the stored network ID of a previously added network. The network
   * ID is stored in the dApp's temporary storage in the filesystem.
   * @private
   * 
   * @param {*} cb Callback called after an attempt to read the network ID from
   * the filesystem, called with parameters:
   *  - {Error} err Error that occurred reading the file from the filesystem.
   *  - {String | Buffer} data Contents of the stored networkId file.
   * 
   * @returns {void}
   */
  [_getStatusNetworkId](cb) {
    fs.readFile(this.networkIdPath, cb);
  }

  /**
   * Stores the network ID of the Status network in the temporary directory of the
   * dApp in the filesystem.
   * @private
   * 
   * @param {String} networkId ID of the Status network
   * 
   * @returns {void}
   */
  [_setStatusNetworkId](networkId) {
    fs.mkdir(this.networkIdDirectory, _err => {
      fs.writeFile(this.networkIdPath, networkId, err => {
        if (err) {
          this.logger.error(`Error storing networkId in embark: ${err.message}`);
        }
      });
    });
  }

  /**
   * Registers this plugin for Embark service checks and sets up log messages for
   * connection and disconnection events. The service check pings the Status app.
   * @private
   * 
   * @returns {void}
   */
  [_registerEvents]() {
    this.embark.registerServiceCheck('Status', (cb) => {
      this.statusApi.ping((_err, state) => {
        const stateName = (state ? 'on' : 'off');
        cb({name: `Status.im (${this.deviceIp})`, status: stateName});
      });
    });

    this.embark.events.on('check:backOnline:Status', () => {
      this.logger.info("------------------");
      this.logger.info("Connected to Status.im mobile app!");
      this.logger.info("------------------");
    });

    this.embark.events.on('check:wentOffline:Status', () => {
      this.logger.error("------------------");
      this.logger.error("Couldn't connect or lost connection to Status.im mobile app...");
      this.logger.error("------------------");
    });
  }
}

export default EmbarkStatusPlugin;
