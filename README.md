# Embark-Status Plugin Setup
Embark-status is a plugin for [Embark](https://github.com/embark-framework/embark) that connects a DApp running in Embark to the [Status.im](https://github.com/status-im/status-react) mobile app. This plugin adds the Embark network (ie the blockchain node spun up by Embark) to the Status.im app, connects the Status app to the node, then opens the DApp in the Status app's DApp browser.

## Installation
In your DApp directory, install the embark-status plugin:
```npm install status-im/embark-status --save-dev```
> NOTE: Please do not install `embark-status` directly from npm as this is a very old package. We are working with the package owner to get this updated as soon as possible. If you have already installed via npm, please uninstall `embark-status` (`npm uninstall embark-status`) before installing using the above command. 

## DApp configuration
Add this config in the DApp's `embark.json`:

```Json
  "plugins": {
    "embark-status": {
      "deviceIp": "your-device-ip",
      "name": "MyDapp"
    }
  }
```
If your DApp is hosted (ie on decentralised storage like IPFS or Swarm), the plugin option `dappUrl` can be specified to override the DApp URL that is opened in the Status DApp browser after `embark-status` is connected to the Status app.
```Json
  "plugins": {
    "embark-status": {
      "deviceIp": "your-device-ip",
      "name": "MyDapp",
      "dappUrl": "https://ipfs.io/ipfs/QmSVa32dFs5SKRmd7EXzuztMbNsZd5LGpCoU1keSrxo9BK"
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
### Blockchain client config
In your DApp, set `config/blockchain.js > development > rpcHost` to `0.0.0.0` (macOS/Linux) or `127.0.0.1` (Windows). This will open up your blockchain client (Geth or Parity) to outside connections.
### Webserver config
In your DApp, set `config/webserver.js > host` to `0.0.0.0` (macOS/Linux) or `127.0.0.1` (Windows). This will open up your webserver to outside connections.
> NOTE: When the Status browser opens the DApp, it will open the IP of the machine running Embark along with the port specified in the webserver config, ie `http://192.168.0.15:8000`. This is so that the device can connect to the webserver started by Embark.
### Storage
Our machine will be running our storage node, and we need to access the node from our DApp, so we have to configure IPFS to run on our machine's IP, then tell embark to access the node via the machine IP.
> NOTE: `embark-status` has only been tested with IPFS. This guide assumes you have [ipfs installed](https://docs.ipfs.io/introduction/install/) and you are using it for your DApp.

#### DApp storage config
In your DApp, set `config/storage.js > dappConnection` to
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
#### IPFS config
Next, we need to update our IPFS API and gateway configuration. 

##### Backup
First, let's backup our working IPFS config:
```
cp ~/.ipfs/config ~/.ipfs/config.bak
```
##### Run IPFS first
In order to interact with IPFS's `config` CLI, we need IPFS to be running first (alternatively, `~/.ipfs/config` (macOS/Linux) can be manually updated with the changes):
```
ipfs daemon
```
##### Run IPFS CLI config update commands
Then run the following commands in a new shell, (replacing `your-machine-ip` with your machine's IP):
```
ipfs config --json Addresses.API "\"/ip4/your-machine-ip/tcp/5001\""
ipfs config --json Addresses.Gateway "\"/ip4/your-machine-ip/tcp/8080\""
```
> NOTE: In this case, we want the IPFS API and gateway to the be accessible from our machine's IP.

##### Stop IPFS daemon
In the first terminal where IPFS daemon is running, stop the IPFS daemon using `Ctrl+c`.

##### When you need to revert your IPFS config
If you'd like to revert to the default settings, run the following two commands:
```
ipfs daemon
```
In a separate shell, run:
```
ipfs config --json Addresses.API "\"/ip4/127.0.0.1/tcp/5001\""
ipfs config --json Addresses.Gateway "\"/ip4/127.0.0.1/tcp/8080\""
```
Alternatively, you could overwrite your IPFS config with your backup:
```
mv ~/.ipfs/config.bak ~/.ipfs/config # overwrite the config
rm ~/.ipfs/config.bak # delete the backup
```
Or, another option is to delete your modified config, and re-init IFPS:
```
rm ~/.ipfs/config
ipfs init
```
The last option will recreate a fresh IPFS config for you.
#### Status.im app
Please make sure the Status app has development mode enabled. To enable development mode: 
1. [Install Status mobile](https://status.im/) if not already done
1. Open the app.
2. Go to Profile (bottom right tab).
3. Scroll to the bottom and tap the "Advanced" button.
4. Enable the "Development mode" toggle

### CORS
NOTE: The device IP specified in the plugin configuration above will be automatically added to CORS for the blockchain client (Geth/Parity) and the storage provider (IPFS/Swarm) when running Embark. 

## Now run Embark
Once all the above has been configured, run your DApp using Embark:
```
embark run
```

## Known issues
#### Status app crashes
There is currently a [bug in the Status app](https://github.com/status-im/status-react/issues/6872) that crashes the app once the `embark-status` plugin attempts to open the DApp in the Status DApp browser. Simply re-open the Status app after this crash. You may have to manually open the DApp for now:
1. Tap the "+" in the top right of the Status app
2. Tap "Open DApp"
3. Enter `your-machine-ip:8000` for the URL.

#### IPFS CORS not updated correctly
Embark up to `4.0.0` is not updating IPFS CORS correctly, due to the need for IPFS to be restarted after update. This has been [fixed in a PR](https://github.com/embark-framework/embark/pull/1458), but has not been released yet. In the meantime, it's probably easiest to simply modify your IPFS config manually. Open up `~/.ipfs/config` (or equivalent in your OS), and edit both the `API/Access-Control-Allow-Origin` and `Gateway/Access-Control-Allow-Origin` sections to look like:
```
"Access-Control-Allow-Origin": [
  "http://your-device-ip",
  "http://your-machine-ip:8000",
  "http://your-machine-ip:8080",
  "http://0.0.0.0:8000",
  "http://0.0.0.0:8545",
  "ws://localhost:8546",
  "http://embark"
]
```
If this is still not working for you, as a last resort, try updating both the `API/Access-Control-Allow-Origin` and `Gateway/Access-Control-Allow-Origin` to:
```
"Access-Control-Allow-Origin": [
  "*"
]
```
#### Please report any other issues you find, thank you!
