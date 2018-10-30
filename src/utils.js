/**
 * Builds a URL
 *
 * @param {string} protocol
 *  The URL protocol, defaults to http.
 * @param {string} host
 *  The URL host, required.
 * @param {string} port
 *  The URL port, default to empty string.
 * @param {string} [type]
 *  Type of connection - used when protocol is false or not specified. Valid options
 *  are 'ws' and 'http'.
 * @returns {string} the constructued URL, with defaults
 */
export function buildUrl(protocol, host, port, type) {
  if (!host) throw new Error('utils.buildUrl: parameter \'host\' is required');
  if (port) port = ':' + port;
  else port = '';
  if (!protocol) {
    protocol = type === 'ws' ? 'ws' : 'http';
  }
  return `${protocol}://${host}${port}`;
}
