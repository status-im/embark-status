const request = require('request');

var StatusDev = function (options) {
  this.url = `http://${options.ip}:5561`;
}

StatusDev.prototype.request = function (endpoint, body, method, cb) {
  //   console.dir("===> " + this.url + endpoint)
  //   console.dir(body)
  request({
    url: this.url + endpoint,
    method: method,
    timeout: 3000,
    json: true,
    body: body
  }, (error, response, respBody) => {
    console.dir(`REQUEST: ${endpoint} ${JSON.stringify(body)}\nRESPONSE: ${JSON.stringify(respBody)}\nERROR: ${error}`);
    cb(error, respBody);
  });
}

// ping
// POST localhost:5561/ping
// response: {"message": "Pong!"}
StatusDev.prototype.ping = function (cb) {
  this.request('/ping', {}, "POST", (err, response) => {
    if (!err && response) return response.message === 'Pong!';
    return false;
  });
}

// POST localhost:5561/dapp/open url=<dapp_url>
// response: { "message": "URL has been opened." }
StatusDev.prototype.openDapp = function (url, cb) {
  this.request('/dapp/open', { url: url }, "POST", cb);
}

// POST localhost:5561/network name=AnyNetworkName url=http://localhost:3000 chain=mainnet network-id=2
// response: { "message": "Network has been added.", "network-id": "1535660846036b3c3241022ec5046af53cdb769dcc216" }
// response: { "message": "Please, check the validity of network information." }
StatusDev.prototype.addNetwork = function (name, nodeUrl, chainName, networkId, cb) {
  this.request('/network', { name: name, url: nodeUrl, chain: chainName, "network-id": networkId }, "POST", cb);
}

// POST localhost:5561/network/connect id=1535660846036b3c3241022ec5046af53cdb769dcc216
// response: { "message": "Network has been connected.", "network-id": "1535660846036b3c3241022ec5046af53cdb769dcc216" }
// response: { "message": "The network id you provided doesn't exist." }
StatusDev.prototype.connect = function (id, cb) {
  this.request('/network/connect', { id: id }, "POST", cb);
}

// DELETE localhost:5561/network id=1535660846036b3c3241022ec5046af53cdb769dcc216
// response: { "message": "Network has been deleted.", "network-id": "1535660846036b3c3241022ec5046af53cdb769dcc216" }
// response: { "message": "Cannot delete the provided network." }
StatusDev.prototype.removeNetwork = function (id, cb) {
  this.request('/network', { id: id }, "DELETE", cb);
}

module.exports = StatusDev
