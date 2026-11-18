const jwt = require('jsonwebtoken');
const { JWT_SECRET, gatewayToken } = require('../shared/security');

function createVerifySession({ fetchImpl = globalThis.fetch } = {}) {
  return async function verifySession(req, res, next) {
    const token = req.header('X-OBSERVATORY-AUTH');
    let identity;
    try {
      identity = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    try {
      const result = await fetchImpl('http://users-service:3000/api/session', {
        method: 'GET',
        headers: {
          'X-OBSERVATORY-AUTH': token,
          'X-Internal-Gateway-Token': gatewayToken,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (result.status === 401) {
        return res.status(401).json({ error: 'Session has been revoked' });
      }
      if (result.status !== 200 || (await result.json()).valid !== true) {
        return res.status(503).json({ error: 'Session validation unavailable' });
      }
      req.user = identity;
      return next();
    } catch {
      return res.status(503).json({ error: 'Session validation unavailable' });
    }
  };
}

module.exports = { createVerifySession };
