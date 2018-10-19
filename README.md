# Overview
Embark-status is a plugin for [Embark](https://github.com/embark-framework/embark) that connects a dApp running in Embark to the [Status.im](https://github.com/status-im/status-react) mobile app. This plugin adds the Embark network (ie the blockchain node spun up by Embark) to the Status.im app, connects the Status app to the node, then opens the dApp in the Status app's dApp browser.

## Installation
In your dApp directory, install the embark-status plugin:
```npm install embark-status --save```

## Configuration
Add this config in the dApp's `embark.json`:

```Json
  "plugins": {
    "embark-status": {
      "deviceIp": "your-device-ip",
      "whisperIdentity": "dapp-test",
      "name": "MyDapp"
    }
  }
```
### Development environment
To configure for a development environment, the blockchain client and the webserver need to be set up to accept outside connections.
#### Blockchain client
Set `config/webserver.js > development > rpcHost` to `0.0.0.0`. This will open up your blockchain client (Geth or Parity) to outside connections.
#### Webserver
Set `config/blockchain.js > host` to `0.0.0.0`. This will open up your webserver to outside connections.
> NOTE: When the Status browser opens the dApp, it will open the IP of the machine running Embark along with the port specified in the webserver config, ie `http://192.168.0.15:8000`. This is so that the device can connect to the webserver started by Embark.

### Hosted dApp
If your dApp is hosted (ie on decentralised storage like IPFS or Swarm), the plugin option `dappUrl` can be specified to override the dApp URL that is opened in the Status dApp browser after `embark-status` is connected to the Status app.
```Json
  "plugins": {
    "embark-status": {
      "deviceIp": "your-device-ip",
      "whisperIdentity": "dapp-test",
      "name": "MyDapp",
      "dappUrl": "https://ipfs.io/ipfs/QmSVa32dFs5SKRmd7EXzuztMbNsZd5LGpCoU1keSrxo9BK"
    }
  }
```

### CORS
The device IP specified in the plugin configuration above will be automatically added to CORS for the blockchain client and the storage provider (IPFS/Swarm). 
then `embark run`.
