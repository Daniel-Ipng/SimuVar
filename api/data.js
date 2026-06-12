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

  const { id, variableId } = req.query;

  // GET: Fetch records for a variable
  if (req.method === 'GET') {
    if (!variableId) {
      return res.status(400).json({ error: 'Se requiere el ID de la variable (variableId) para consultar los datos.' });
    }

    try {
      const selectQuery = 'SELECT id, variable_id, value::float as value, created_at FROM data_records WHERE variable_id = $1 ORDER BY created_at ASC, id ASC';
      const result = await pool.query(selectQuery, [variableId]);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching data records:', error);
      return res.status(500).json({ error: 'Error del servidor al obtener los datos: ' + error.message });
    }
  }

  // POST: Insert single or bulk data points
  if (req.method === 'POST') {
    try {
      const { variableId: bodyVariableId, value, values } = req.body;
      const targetVariableId = bodyVariableId || variableId;

      if (!targetVariableId) {
        return res.status(400).json({ error: 'Se requiere el ID de la variable (variableId).' });
      }

      // 1. Check if variable exists and fetch its type & owner
      const varResult = await pool.query('SELECT type, user_id FROM variables WHERE id = $1', [targetVariableId]);
      if (varResult.rows.length === 0) {
        return res.status(404).json({ error: 'La variable seleccionada no existe.' });
      }
      
      const variable = varResult.rows[0];

      // 2. Authorization check: Owner of variable or Admin
      if (variable.user_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permiso para agregar datos a esta variable.' });
      }

      // 3. Collect values to insert
      let valuesToInsert = [];
      if (values !== undefined && Array.isArray(values)) {
        valuesToInsert = values.map(v => parseFloat(v));
      } else if (value !== undefined) {
        valuesToInsert = [parseFloat(value)];
      } else {
        return res.status(400).json({ error: 'Debe proporcionar un valor (value) o una lista de valores (values).' });
      }

      // 4. Validate numbers and type (integer for discreta)
      if (valuesToInsert.length === 0) {
        return res.status(400).json({ error: 'La lista de valores no puede estar vacía.' });
      }

      for (const val of valuesToInsert) {
        if (isNaN(val)) {
          return res.status(400).json({ error: 'Uno o más de los valores proporcionados no son números válidos.' });
        }
        
        if (variable.type === 'discreta' && val % 1 !== 0) {
          return res.status(400).json({ error: `La variable es discreta. El valor ${val} no es un número entero válido.` });
        }
      }

      // 5. Build bulk insertion query for performance
      let queryText = 'INSERT INTO data_records (variable_id, value) VALUES ';
      const queryParams = [];
      
      for (let i = 0; i < valuesToInsert.length; i++) {
        queryText += `($${i * 2 + 1}, $${i * 2 + 2})`;
        if (i < valuesToInsert.length - 1) {
          queryText += ', ';
        }
        queryParams.push(targetVariableId, valuesToInsert[i]);
      }
      
      queryText += ' RETURNING id, variable_id, value::float as value, created_at';
      
      const insertResult = await pool.query(queryText, queryParams);
      
      return res.status(201).json({
        message: `${insertResult.rows.length} registros insertados con éxito.`,
        records: insertResult.rows
      });

    } catch (error) {
      console.error('Error inserting data records:', error);
      return res.status(500).json({ error: 'Error del servidor al registrar los datos: ' + error.message });
    }
  }

  // PUT: Update a single data point
  if (req.method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: 'Se requiere el ID del registro a actualizar.' });
    }

    try {
      const { value } = req.body;
      if (value === undefined || isNaN(parseFloat(value))) {
        return res.status(400).json({ error: 'Debe proporcionar un valor numérico válido.' });
      }

      const updatedVal = parseFloat(value);

      // Verify ownership via variable
      const recordQuery = `
        SELECT r.id, r.variable_id, v.type, v.user_id 
        FROM data_records r
        JOIN variables v ON r.variable_id = v.id
        WHERE r.id = $1
      `;
      const recordResult = await pool.query(recordQuery, [id]);
      if (recordResult.rows.length === 0) {
        return res.status(404).json({ error: 'Registro de datos no encontrado.' });
      }

      const record = recordResult.rows[0];
      if (record.user_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permiso para modificar este registro.' });
      }

      // Check type constraint
      if (record.type === 'discreta' && updatedVal % 1 !== 0) {
        return res.status(400).json({ error: `La variable es discreta. El valor ${updatedVal} debe ser un entero.` });
      }

      const updateResult = await pool.query(
        'UPDATE data_records SET value = $1 WHERE id = $2 RETURNING id, variable_id, value::float as value, created_at',
        [updatedVal, id]
      );

      return res.status(200).json({
        message: 'Registro actualizado con éxito.',
        record: updateResult.rows[0]
      });

    } catch (error) {
      console.error('Error updating data record:', error);
      return res.status(500).json({ error: 'Error del servidor al actualizar el registro: ' + error.message });
    }
  }

  // DELETE: Delete a single record, or clear all records for a variable
  if (req.method === 'DELETE') {
    try {
      // Option A: Clear all records for a variable
      if (variableId) {
        // Validate variable ownership
        const varCheck = await pool.query('SELECT user_id FROM variables WHERE id = $1', [variableId]);
        if (varCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Variable no encontrada.' });
        }

        const variable = varCheck.rows[0];
        if (variable.user_id !== user.id && user.role !== 'admin') {
          return res.status(403).json({ error: 'No tienes permiso para borrar los datos de esta variable.' });
        }

        await pool.query('DELETE FROM data_records WHERE variable_id = $1', [variableId]);
        return res.status(200).json({ message: 'Todos los datos de la variable han sido eliminados.' });
      }

      // Option B: Delete single record by ID
      if (!id) {
        return res.status(400).json({ error: 'Se requiere el ID del registro a eliminar o el variableId para vaciar los datos.' });
      }

      const recordQuery = `
        SELECT r.id, v.user_id 
        FROM data_records r
        JOIN variables v ON r.variable_id = v.id
        WHERE r.id = $1
      `;
      const recordResult = await pool.query(recordQuery, [id]);
      if (recordResult.rows.length === 0) {
        return res.status(404).json({ error: 'Registro de datos no encontrado.' });
      }

      const record = recordResult.rows[0];
      if (record.user_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este registro.' });
      }

      await pool.query('DELETE FROM data_records WHERE id = $1', [id]);
      return res.status(200).json({ message: 'Registro de datos eliminado con éxito.' });

    } catch (error) {
      console.error('Error deleting data record:', error);
      return res.status(500).json({ error: 'Error del servidor al eliminar el/los registros: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
