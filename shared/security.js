const crypto = require('node:crypto');
function requireSecret(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim().length < 32 || /^(change|replace|example)/i.test(value)) {
    throw new Error(`${name} must be configured with at least 32 random characters`);
  }
  return value;
}
const JWT_SECRET = requireSecret('JWT_SECRET');
const gatewayToken = requireSecret('INTERNAL_GATEWAY_TOKEN');
function trustedGateway(req, res, next) {
  const actual = Buffer.from(req.header('X-Internal-Gateway-Token') || '');
  const expected = Buffer.from(gatewayToken);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({error: 'Authenticated gateway required'});
  }
  return next();
}
module.exports = { JWT_SECRET, gatewayToken, requireSecret, trustedGateway };
