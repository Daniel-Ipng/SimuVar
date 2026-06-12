const pool = require('../db');
const bcrypt = require('bcryptjs');
const { signToken } = require('./helper');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Query database
    const userQuery = 'SELECT id, username, password_hash, role FROM users WHERE LOWER(username) = $1';
    const result = await pool.query(userQuery, [trimmedUsername]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = result.rows[0];

    // Check password hash
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // Generate token
    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error del servidor al iniciar sesión: ' + error.message });
  }
};
