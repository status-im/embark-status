const request = require('request');

var StatusDev = function(options) {
	this.url = `http://${options.ip}:5561`;
}

StatusDev.prototype.request = function(url, body, method, cb) {
	request({
		url: url,
		method: method,
		timeout: 3000,
		json: true,
		body: body
	}, (error, response, body) => {
		cb(error, body);
	})
}

// ping
// POST localhost:5561/ping
// response: {"message": "Pong!"}
StatusDev.prototype.ping = function(cb) {
	request('/ping', {}, "POST", cb);
}

// POST localhost:5561/dapp/open url=<dapp_url>
// response: { "message": "URL has been opened." }
StatusDev.prototype.addDapp = function(url, cb) {
	request('/dapp/open', {url: url}, "POST", cb);
}

// POST localhost:5561/network name=AnyNetworkName url=http://localhost:3000 chain=mainnet network-id=2
// response: { "message": "Network has been added.", "network-id": "1535660846036b3c3241022ec5046af53cdb769dcc216" }
// response: { "message": "Please, check the validity of network information." }
StatusDev.prototype.addNetwork = function(name, nodeUrl, chainName, networkId, cb) {
	request('/network', {name: name, url: nodeUrl, chain: chainName, "network-id": networkId}, "POST", cb);
}

// POST localhost:5561/network/connect id=1535660846036b3c3241022ec5046af53cdb769dcc216
// response: { "message": "Network has been connected.", "network-id": "1535660846036b3c3241022ec5046af53cdb769dcc216" }
// response: { "message": "The network id you provided doesn't exist." }
StatusDev.prototype.connect = function(id, cb) {
	request('/network/connect', {id: id}, "POST", cb);
}

// DELETE localhost:5561/network id=1535660846036b3c3241022ec5046af53cdb769dcc216
// response: { "message": "Network has been deleted.", "network-id": "1535660846036b3c3241022ec5046af53cdb769dcc216" }
// response: { "message": "Cannot delete the provided network." }
StatusDev.prototype.removeNetwork = function(id, cb) {
	request('/network', {id: id}, "DELETE", cb);
}

module.exports = StatusDev
