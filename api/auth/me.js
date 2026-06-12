const { verifyToken } = require('./helper');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Por favor inicie sesión.' });
  }

  // Token is valid, return the user payload
  return res.status(200).json({
    authenticated: true,
    user: {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    }
  });
};
