# Overview
Embark-status is a plugin for [Embark](https://github.com/embark-framework/embark) that connects a dApp running in Embark to the [Status.im](https://github.com/status-im/status-react) mobile app. This plugin adds the Embark network (ie the blockchain node spun up by Embark) to the Status.im app, connects the Status app to the node, then opens the dApp in the Status app's dApp browser.

## Installation
In your dApp directory, install the embark-status plugin:
```npm install status-im/embark-status --save-dev```
> NOTE: Please do not install `embark-status` directly from npm as this is a very old package. We are working with the package owner to get this updated as soon as possible. If you have already installed via npm, please uninstall `embark-status` (`npm uninstall embark-status`) before installing using the above command. 

## Configuration
Add this config in the dApp's `embark.json`:

```Json
  "plugins": {
    "embark-status": {
      "deviceIp": "your-device-ip",
      "name": "MyDapp"
    }
  }
```
### Development environment
To configure for a development environment, please ensure you are running the correct version of NodeJS. Additionally, the blockchain client, webserver, and storage need to be set up to accept outside connections.
#### NodeJS Version
The minimum version of NodeJS that can be used is `8.11.3`. If you need to change your Node version, please [use NVM](https://github.com/creationix/nvm).
```
$> node --version
v8.11.3
```
#### Blockchain client
In your dApp, set `config/blockchain.js > development > rpcHost` to `0.0.0.0`. This will open up your blockchain client (Geth or Parity) to outside connections.
#### Webserver
In your dApp, set `config/webserver.js > host` to `0.0.0.0`. This will open up your webserver to outside connections.
> NOTE: When the Status browser opens the dApp, it will open the IP of the machine running Embark along with the port specified in the webserver config, ie `http://192.168.0.15:8000`. This is so that the device can connect to the webserver started by Embark.
#### Storage
Our machine will be running our storage node, and we need to access the node from our dApp, so we have to configure IPFS to run on our machine's IP, then tell embark to access the node via the machine IP.
> NOTE: `embark-status` has only been tested with IPFS. This guide assumes you have [ipfs installed](https://docs.ipfs.io/introduction/install/) and you are using it for your dApp.

In your dApp, set `config/storage.js > dappConnection` to
```
dappConnection: [
  {
    provider: "ipfs",
    host: "your-machine-ip",
    port: 5001,
    getUrl: "http://your-machine-ip:8080/ipfs/"
  }
]
```
Then run the following commands, of course replacing `your-machine-ip` with your machine's IP:
```
ipfs config --json Addresses.API "\"/ip4/your-machine-ip/tcp/5001\""
ipfs config --json Addresses.Gateway "\"/ip4/your-machine-ip/tcp/8080\""
```
> NOTE: In this case, we want the IPFS API and gateway to the be accessible from our machine's IP.

If you'd like to revert to the default settings, run the following two commands:
```
ipfs config --json Addresses.API "\"/ip4/127.0.0.1/tcp/5001\""
ipfs config --json Addresses.Gateway "\"/ip4/127.0.0.1/tcp/8080\""
```
#### Status.im app
Please make sure the Status app has development mode enabled. To enable development mode: 
1. Open the app.
2. Go to Profile (bottom right tab).
3. Scroll to the bottom and tap the "Advanced" button.
4. Enable the "Development mode" toggle

### Hosted dApp
If your dApp is hosted (ie on decentralised storage like IPFS or Swarm), the plugin option `dappUrl` can be specified to override the dApp URL that is opened in the Status dApp browser after `embark-status` is connected to the Status app.
```Json
  "plugins": {
    "embark-status": {
      "deviceIp": "your-device-ip",
      "name": "MyDapp",
      "dappUrl": "https://ipfs.io/ipfs/QmSVa32dFs5SKRmd7EXzuztMbNsZd5LGpCoU1keSrxo9BK"
    }
  }
```

### CORS
The device IP specified in the plugin configuration above will be automatically added to CORS for the blockchain client (Geth/Parity) and the storage provider (IPFS/Swarm). 

## Now run embark
```
embark run
```

## Known issues
#### Status app crashes
There is currently a [bug in the Status app](https://github.com/status-im/status-react/issues/6872) that crashes the app once the `embark-status` plugin attempts to open the dApp in the Status dApp browser. Simply re-open the Status app after this crash. You may have to manually open the dApp for now:
1. Tap the "+" in the top right of the Status app
2. Tap "Open DApp"
3. Enter `your-machine-ip:8000` for the URL.

#### IPFS CORS not updated correctly
Embark up to `alpha.2` is not updating IPFS CORS correctly, due to the need for IPFS to be restarted after update. This has been [fixed in Embark `master`](https://github.com/embark-framework/embark/pull/1139), however it has not yet made it's way in to an Embark release. In the meantime, it's probably easiest to simply modify your IPFS config manually. Open up `~/.ipfs/config` (or equivalent in your OS), and edit the `API/Access-Control-Allow-Origin` section to look like:
```
"Access-Control-Allow-Origin": [
  "http://your-machine-ip",
  "http://your-device-ip:8000",
  "http://your-device-ip:8080",
  "http://0.0.0.0:8000",
  "http://0.0.0.0:8545",
  "ws://localhost:8546"
]
```
The fixes for the above are sitting in the `master` branch of embark. As an alternative to modifying the IPFS config manually, you could checkout the `master` branch from embark and run `bin/embark run` on your dapp.
