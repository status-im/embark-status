import StatusApi from './statusApi.js';
import { buildUrl } from './utils';
import { queue } from 'async';
const Ip = require('ip');
const path = require('path');
const hash = require('object-hash');

// Network constants
const CONNECT_INTERVAL = 5000; // Duration (in ms) to wait before attempting to reconnect.
const CHAIN_NAME = 'embark';
const NETWORK_NAME = 'Embark';
const DEFAULT_NETWORK_ID = 1337;
const API_REQUEST_TIMEOUT = 30000;

// Service check constants
const SERVICE_CHECK_ON = 'on';
const SERVICE_CHECK_OFF = 'off';

// Device constants
const DEVICE_PROTOCOL = 'http';
const DEVICE_PORT = 5561;

// Local machine host constants
const LOCAL_HOSTS = ['0.0.0.0', 'localhost'];

// App not running response codes
const NOT_RUNNING_RESPONSES = ['ECONNREFUSED', 'ETIMEDOUT'];

// Private backing variables
let _networkSettings = null;

/**
 * Plugin that connects an Embark dApp to the Status app, and allows the dApp
 * to be run in the Status browser.
 */
class EmbarkStatusPlugin {
  constructor(embark) {
    this.networkId = DEFAULT_NETWORK_ID;
    this.embark = embark;
    this.events = this.embark.events;
    this.pluginConfig = this.embark.pluginConfig;
    this.deviceIp = this.pluginConfig.deviceIp;
    this.logger = this.embark.logger;
    // we want a timeout to occur before issuing the next request, so reduce the timeout specified
    this.statusApi = new StatusApi({ protocol: DEVICE_PROTOCOL, deviceIp: this.deviceIp, port: DEVICE_PORT, logger: this.logger, timeout: API_REQUEST_TIMEOUT });
    this.webServerConfig = {};
    this.blockchainConfig = {};
    this.networkIdDirectory = path.join(process.env.DAPP_PATH, '.embark', 'embark-status');
    this.networkIdPath = path.join(this.networkIdDirectory, 'networkId');

    // gets hydrated webserver config from embark
    this.events.on('config:load:webserver', webServerConfig => {
      this.webServerConfig = webServerConfig;
      _networkSettings = null; // reset backing var to recompute hash
    });

    // gets hydrated blockchain config from embark
    this.events.on('config:load:blockchain', blockchainConfig => {
      this.blockchainConfig = blockchainConfig;
      _networkSettings = null; // reset backing var to recompute hash
    });

    // adds cors to blockchain and storage clients
    this.events.request('config:cors:add', `${DEVICE_PROTOCOL}://${this.deviceIp}`);

    // register service check
    //this._registerServiceCheck();

    this._startContinuousPing();

    // kick off network connection, and open dapp after connection
    this.connectStatusToEmbark();

  }

  /**
   * Returns an object containing all settings needed for a Status network.
   * The returned object includes a hash that can be used to uniquely identify the
   * Status network ID.
   * 
   * @returns {Object} Settings for a Status network:
   *  - {...Object} pluginConfg All properties passed in from the plugin config
   *  - {String} networkName Display name of the network to add to Status
   *  - {String} nodeUrl URL of the blockchain node to connect to
   *  - {String} chainName Name of the chain to connect to
   *  - {Number} networkId ID of the chain to connect to
   *  - {String} hash Computed hash of all settings above
   */
  get networkSettings() {
    if (!_networkSettings) {
      const nodePort = this.blockchainConfig.proxy ? this.blockchainConfig.rpcPort + 10 : this.blockchainConfig.rpcPort;
      let blockchainHost = this.blockchainConfig.rpcHost;
      if (LOCAL_HOSTS.some(host => host === blockchainHost)) {
        blockchainHost = Ip.address();
      }
      const nodeUrl = buildUrl('http', blockchainHost, nodePort);
      const networkName = `${NETWORK_NAME} (${this.pluginConfig.name})`;

      const settings = Object.assign(this.pluginConfig, { networkName, nodeUrl, chainName: CHAIN_NAME, networkId: this.networkId });
      const settingsHash = hash(settings);
      _networkSettings = Object.assign(settings, { hash: settingsHash });
    }
    return _networkSettings;
  }

  static _isNotRunningError(code) {
    return NOT_RUNNING_RESPONSES.some(responseCode => responseCode === code);
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
    this.events.once('blockchain:ready', (_isReady) => {
      this.events.request('blockchain:networkId', networkId => {
        this.networkId = networkId;
        const connectIntervalId = setInterval(() => {
          if (this.blockchainConfig === {} || this.webServerConfig === {}) return; // embark hasn't loaded configs yet
          this._connectStatus((err, result) => {
            if (err) return this.logger.error(err);

            // now that we're connected, stop trying to re-connect
            clearInterval(connectIntervalId);

            // attempt to open the dApp once
            // status will restart once the network is switched, wait for reconnect
            if (result && result.alreadyConnected !== true) {
              return this.events.once('embark-status:connect', () => {
                this.openDapp(err => {
                  if (err) this.logger.error(err);
                });
              });
            }
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
    if (LOCAL_HOSTS.some(host => host === dappHost)) {
      dappHost = Ip.address();
    }
    const dappUrl = this.pluginConfig.dappUrl || buildUrl('http', dappHost, this.webServerConfig.port) + '/';

    this.logger.info(`Opening ${this.pluginConfig.name} (${dappUrl}) in the Status browser...`);
    this.statusApi.openDapp(dappUrl, (err, result) => {
      if (err) {
        if (EmbarkStatusPlugin._isNotRunningError(err.code)) {
          return cb(`Failed to open ${this.pluginConfig.name} in the Status app. Is the Status app open?`);
        }
        return cb(`Error opening ${this.pluginConfig.name} in the Status app: ${err.message}.`);
      }
      this.logger.info(`${this.pluginConfig.name} opened successfully.`);
      cb(null, result);
    });
  }

  _startContinuousPing() {
    setInterval(() => {
      this.statusApi.ping((err, isOnline) => {
        if (!err && isOnline) {
          this.events.emit('embark-status:connect');
        }
      });
    }, 2000);
  }

  /**
   * Connects the Status app to an Embark network (node running in this dApp).
   * If the network doesn't exist, it is added. Network (node) settings are 
   * taken from the dApp's blockchain config rpcHost and rpcPort. CORS for the
   * device IP are setup automatically.
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
  _connectStatus(cb) {
    this.statusApi.ping((err, isOnline) => {
      if (err || !isOnline) return cb('Status app is not responding. Is it open? Are you logged in?');

      this.events.emit('embark-status:connect');

      this.statusApi.networks((err, networkList) => {
        if (err || !networkList) return cb(`Error getting list of networks from the Status app: ${err}`);
        const networks = networkList.networks;
        const { nodeUrl, networkId, networkName } = this.networkSettings;
        const statusNetworkId = Object.keys(networks).find(networkKey => {
          const network = networks[networkKey];
          return network.config &&
            network.config.UpstreamConfig &&
            network.config.UpstreamConfig.URL === nodeUrl &&
            network.config.NetworkId === networkId &&
            network.name === networkName;
        });
        if (statusNetworkId) {
          this.statusNetworkId = statusNetworkId;
          if (networks[statusNetworkId]['active?'] === true) return cb(null, { alreadyConnected: true }); // already connected to this network, do nothing
          return this._connectToStatusNetwork(this.statusNetworkId, cb); // connect to the already added network
        }
        // otherwise, add a new network and connect to that network
        this._addAndConnectStatusNetwork(cb);
      });

    });


  }

  /**
   * Connects the Status app to a network specified by the `statusNetworkId`
   * parameter.
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
  _connectToStatusNetwork(statusNetworkId, cb) {
    const { nodeUrl } = this.networkSettings;
    this.logger.info(`Connecting Status app to network ${nodeUrl}...`);
    this.statusApi.connect(statusNetworkId, (err, result) => {
      if (err) {
        if (EmbarkStatusPlugin._isNotRunningError(err.code)) {
          return cb('Failed to connect to the Status network. Is the Status app open? Are you logged in?');
        }
        return cb(`Error while connecting to Status network ${nodeUrl} in the Status app: ${err.message}.`);
      }
      this.logger.info(`Successfully connected to network ${nodeUrl}.`);
      cb(null, result);
    });
  }

  /**
   * Adds a network to the Status app, then attempts to connect to it. Upon a
   * successful addition of the network, the Status app will return a network ID,
   * which is stored in the dApp's temporary filesystem to prevent future additions
   * of an already exist network in the Status app.
   * 
   * @param {Function} cb Callback called after the connect to network command 
   * is sent to the Status app, called with parameters:
   *  - {String} err Error that occurred adding and connecting a network.
   *  - {Object} result Result returned from the Status app on successful 
   *             connection to the Embark network.
   * 
   * @returns {void}
   */
  _addAndConnectStatusNetwork(cb) {
    // defined here because the configs have not been hydrated from the dapp when the plugin is instantiated
    const { nodeUrl, networkName, chainName, networkId } = this.networkSettings;

    this.logger.info(`Adding network '${networkName}' to Status...`);
    return this.statusApi.addNetwork(networkName, nodeUrl, chainName, this.networkId, (err, result) => {
      if (err) {
        if (EmbarkStatusPlugin._isNotRunningError(err.code)) {
          return cb('Failed to add a network to the Status app. Is the Status app open? Are you logged in?');
        }
        return cb(`Error while adding network ${nodeUrl} (name: ${chainName}, networkId: ${networkId}) to the Status App: ${err.message}.`);
      }
      if (!err && !result) {
        return cb(`Empty response from the Status app. Is it possible your phone is in standby or the Status app is in the background?`);
      }
      const statusNetworkId = result['network-id'];
      if (!statusNetworkId) {
        return cb(`Status app returned a bad response (no 'network-id' present), could not connect.`);
      }
      this.logger.info(`Network '${networkName}' added successfully.`);
      this.statusNetworkId = statusNetworkId;
      this._connectToStatusNetwork(statusNetworkId, cb);
    });
  }

  /**
   * Registers this plugin for Embark service checks and sets up log messages for
   * connection and disconnection events. The service check pings the Status app.
   * 
   * @returns {void}
   */
  _registerServiceCheck() {
    const serviceCheckQueue = queue((task, callback) => {
      this.statusApi.ping((err, isOnline) => {
        if (!err && isOnline) this.events.emit('embark-status:connect');
        const stateName = (isOnline ? SERVICE_CHECK_ON : SERVICE_CHECK_OFF);
        task.cb({ name: `Status.im (${this.deviceIp})`, status: stateName });
      });
      callback();
    }, 1);
    // this.embark.registerServiceCheck('Status', (cb) => {
    //   serviceCheckQueue.push({ cb });
    // });
    this.embark.registerServiceCheck('Status', (cb) => {
      serviceCheckQueue.push({ cb });

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
