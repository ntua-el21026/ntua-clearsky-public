const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../shared/security');
const { hashPassword, verifyPassword } = require('../shared/passwords');
const pool = require('./db');
const verifyToken = token => jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

async function login(req, res) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({error: 'Missing username or password'});
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const rows = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({error: 'Invalid credentials'});
    const verified = await verifyPassword(password, user.password_hash);
    if (!verified.valid) return res.status(401).json({error: 'Invalid credentials'});
    if (verified.needsRehash) {
      const replacement = await hashPassword(password);
      const result = await connection.execute(
        'UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?',
        [replacement, user.id, user.password_hash]
      );
      if (Number(result.affectedRows) !== 1) return res.status(401).json({error: 'Credentials changed; log in again'});
    }
    const payload = {id: user.id, username: user.username, role: user.user_role, institution: user.institution};
    if (user.user_role === 'student') payload.student_id = user.student_id;
    const token = jwt.sign(payload, JWT_SECRET, {expiresIn: '1h', algorithm: 'HS256'});
    return res.json({token, role: user.user_role});
  } catch {
    return res.status(503).json({error: 'Authentication temporarily unavailable'});
  } finally {
    if (connection) connection.release();
  }
}

function institution(req, res) {
  try {
    const requester = verifyToken(req.header('X-OBSERVATORY-AUTH'));
    if (requester.role === 'institution' && requester.institution) return requester;
  } catch {}
  res.status(403).json({error: 'Institution authorization required'});
  return null;
}

async function register(req, res) {
  const requester = institution(req, res);
  if (!requester) return;
  const {username, password, role, student_id} = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password ||
      !['student', 'instructor'].includes(role) || (role === 'student' && !student_id)) {
    return res.status(400).json({error: 'Valid username, password, role and student ID (when applicable) required'});
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const existing = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) return res.status(409).json({error: 'Account already exists'});
    const hash = await hashPassword(password);
    await connection.execute(
      'INSERT INTO users (username, password_hash, user_role, student_id, institution) VALUES (?, ?, ?, ?, ?)',
      [username, hash, role, role === 'student' ? student_id : null, requester.institution]
    );
    return res.json({message: 'User registered successfully'});
  } catch {
    return res.status(503).json({error: 'User registration unavailable'});
  } finally { if (connection) connection.release(); }
}

async function updatePassword(req, res) {
  const requester = institution(req, res);
  if (!requester) return;
  const {username, password, role, student_id} = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password ||
      !['student', 'instructor'].includes(role) || (role === 'student' && !student_id)) {
    return res.status(400).json({error: 'Valid username, password, role and student ID (when applicable) required'});
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const condition = 'username = ? AND user_role = ? AND institution = ?' + (role === 'student' ? ' AND student_id = ?' : '');
    const args = [username, role, requester.institution];
    if (role === 'student') args.push(student_id);
    const existing = await connection.query(`SELECT id FROM users WHERE ${condition}`, args);
    if (!existing.length) return res.status(404).json({error: 'User not found in your institution'});
    const hash = await hashPassword(password);
    await connection.query(`UPDATE users SET password_hash = ? WHERE ${condition}`, [hash, ...args]);
    return res.json({message: 'Password updated successfully'});
  } catch {
    return res.status(503).json({error: 'Password update unavailable'});
  } finally { if (connection) connection.release(); }
}

async function logout(req, res) {
  const token = req.header('X-OBSERVATORY-AUTH');
  try { verifyToken(token); } catch { return res.status(401).json({error: 'Invalid or expired token'}); }
  let connection;
  try {
    connection = await pool.getConnection();
    const rows = await connection.execute('SELECT token FROM blacklisted_tokens WHERE token = ? LIMIT 1', [token]);
    if (rows.length) return res.status(401).json({error: 'Token is blacklisted'});
    await connection.execute('INSERT INTO blacklisted_tokens (token) VALUES (?)', [token]);
    return res.sendStatus(200);
  } catch { return res.status(503).json({error: 'Logout unavailable'}); }
  finally { if (connection) connection.release(); }
}
async function validateSession(req, res) {
  const token = req.header('X-OBSERVATORY-AUTH');
  try { verifyToken(token); } catch {
    return res.status(401).json({error: 'Invalid or expired token'});
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const rows = await connection.execute(
      'SELECT token FROM blacklisted_tokens WHERE token = ? LIMIT 1', [token]
    );
    if (!Array.isArray(rows)) throw new Error('Invalid session query result');
    if (rows.length) return res.status(401).json({error: 'Session has been revoked'});
    return res.json({valid: true});
  } catch {
    return res.status(503).json({error: 'Session validation unavailable'});
  } finally { if (connection) connection.release(); }
}
module.exports = {login, register, logout, updatePassword, validateSession};
