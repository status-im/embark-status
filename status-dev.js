var request = require('request');

function fromAscii(str) {
  var hex = "";
  for(var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    var n = code.toString(16);
    hex += n.length < 2 ? '0' + n : n;
  }

  return "0x" + hex;
}

var Status = function(deviceIp) {
  this.deviceIp = deviceIp;
};

Status.prototype.switchNodes = function(rpcUrl) {
  request({
    url: "http://" + this.deviceIp + ":5561/switch-node",
    method: "POST",
    json: true,
    body: { encoded: {rpc: rpcUrl}}
  }, function() {
  });
};

Status.prototype.addDapp = function(dappData) {
  request({
    url: "http://" + this.deviceIp + ":5561/add-dapp",
    method: "POST",
    json: true,
    body: { encoded: fromAscii(JSON.stringify(dappData)) }
  }, function(error, response, body) {
  });
};

Status.prototype.changeDapp = function(dappData) {
  request({
    url: "http://" + this.deviceIp + ":5561/dapp-changed",
    method: "POST",
    json: true,
    body: { encoded: fromAscii(JSON.stringify(dappData)) }
  }, function(error, response, body) {
  });
};

module.exports = Status;

