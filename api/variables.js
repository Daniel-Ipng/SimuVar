const pool = require('./db');
const { verifyToken } = require('./auth/helper');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authenticate user
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'No autorizado. Se requiere inicio de sesión.' });
  }

  const { id } = req.query;

  // GET: List all variables
  if (req.method === 'GET') {
    try {
      const selectQuery = `
        SELECT v.id, v.name, v.description, v.type, v.user_id, u.username as creator, v.created_at,
        (SELECT COUNT(*)::int FROM data_records d WHERE d.variable_id = v.id) as data_count
        FROM variables v
        LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
      `;
      const result = await pool.query(selectQuery);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching variables:', error);
      return res.status(500).json({ error: 'Error del servidor al obtener las variables: ' + error.message });
    }
  }

  // POST: Create variable
  if (req.method === 'POST') {
    try {
      const { name, description, type } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'El nombre y el tipo de variable son obligatorios.' });
      }

      if (type !== 'discreta' && type !== 'continua') {
        return res.status(400).json({ error: 'El tipo de variable debe ser "discreta" o "continua".' });
      }

      const insertQuery = `
        INSERT INTO variables (name, description, type, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, description, type, user_id, created_at
      `;
      const result = await pool.query(insertQuery, [
        name.trim(),
        description ? description.trim() : '',
        type,
        user.id
      ]);

      const newVar = result.rows[0];
      newVar.creator = user.username;
      newVar.data_count = 0;

      return res.status(201).json(newVar);
    } catch (error) {
      console.error('Error creating variable:', error);
      return res.status(500).json({ error: 'Error del servidor al registrar la variable: ' + error.message });
    }
  }

  // PUT: Update variable details
  if (req.method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: 'Se requiere el ID de la variable a actualizar.' });
    }

    try {
      const { name, description, type } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'El nombre y el tipo de variable son obligatorios.' });
      }

      if (type !== 'discreta' && type !== 'continua') {
        return res.status(400).json({ error: 'El tipo de variable debe ser "discreta" o "continua".' });
      }

      // Verify ownership or admin status
      const checkResult = await pool.query('SELECT user_id, type FROM variables WHERE id = $1', [id]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Variable no encontrada.' });
      }

      const originalVariable = checkResult.rows[0];
      if (originalVariable.user_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permiso para modificar esta variable.' });
      }

      // Integrity check: If switching to 'discreta', verify no decimal values exist in database
      if (originalVariable.type === 'continua' && type === 'discreta') {
        const decimalsCheck = await pool.query(
          'SELECT COUNT(*)::int FROM data_records WHERE variable_id = $1 AND value % 1 <> 0',
          [id]
        );
        if (decimalsCheck.rows[0].count > 0) {
          return res.status(400).json({
            error: 'No se puede cambiar el tipo a "discreta" porque existen valores con decimales en los datos. Limpie o elimine esos valores primero.'
          });
        }
      }

      const updateQuery = `
        UPDATE variables
        SET name = $1, description = $2, type = $3
        WHERE id = $4
        RETURNING id, name, description, type, user_id, created_at
      `;
      const result = await pool.query(updateQuery, [
        name.trim(),
        description ? description.trim() : '',
        type,
        id
      ]);

      const updatedVar = result.rows[0];

      // Attach additional context for client refresh
      const creatorResult = await pool.query('SELECT username FROM users WHERE id = $1', [updatedVar.user_id]);
      updatedVar.creator = creatorResult.rows[0] ? creatorResult.rows[0].username : 'Desconocido';
      
      const countResult = await pool.query('SELECT COUNT(*)::int FROM data_records WHERE variable_id = $1', [id]);
      updatedVar.data_count = countResult.rows[0].count;

      return res.status(200).json(updatedVar);

    } catch (error) {
      console.error('Error updating variable:', error);
      return res.status(500).json({ error: 'Error del servidor al actualizar la variable: ' + error.message });
    }
  }

  // DELETE: Delete variable and cascade remove data
  if (req.method === 'DELETE') {
    if (!id) {
      return res.status(400).json({ error: 'Se requiere el ID de la variable a eliminar.' });
    }

    try {
      // Verify ownership or admin status
      const checkResult = await pool.query('SELECT user_id FROM variables WHERE id = $1', [id]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Variable no encontrada.' });
      }

      const originalVariable = checkResult.rows[0];
      if (originalVariable.user_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta variable.' });
      }

      await pool.query('DELETE FROM variables WHERE id = $1', [id]);
      return res.status(200).json({ message: 'Variable y todos los registros de datos asociados eliminados exitosamente.' });

    } catch (error) {
      console.error('Error deleting variable:', error);
      return res.status(500).json({ error: 'Error del servidor al eliminar la variable: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
