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
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Todos los campos (usuario, contraseña, rol) son obligatorios.' });
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    if (role !== 'admin' && role !== 'investigador') {
      return res.status(400).json({ error: 'Rol inválido. Debe ser administrador o investigador.' });
    }

    // Check database if user already exists
    const userExistResult = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [trimmedUsername]);
    if (userExistResult.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Write user to DB
    const insertResult = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [trimmedUsername, passwordHash, role]
    );

    const user = insertResult.rows[0];

    // Generate JWT token
    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return res.status(201).json({
      message: 'Registro exitoso',
      token,
      user
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Error del servidor al registrar el usuario: ' + error.message });
  }
};
