const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool;
let useMock = false;

// Mock database file path
const mockFilePath = path.join(__dirname, '..', 'mock_database.json');

// Helper to load mock database JSON
function loadMockData() {
  if (!fs.existsSync(mockFilePath)) {
    fs.writeFileSync(mockFilePath, JSON.stringify({ users: [], variables: [], data_records: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
  } catch (e) {
    return { users: [], variables: [], data_records: [] };
  }
}

// Helper to save mock database JSON
function saveMockData(data) {
  fs.writeFileSync(mockFilePath, JSON.stringify(data, null, 2));
}

// Simple SQL query parser/emulator to support zero-config local runs
async function mockQuery(text, params = []) {
  const data = loadMockData();
  const sql = text.trim().replace(/\s+/g, ' ');

  // 1. SELECT user by username for login
  if (sql.includes('SELECT id, username, password_hash, role FROM users')) {
    const username = params[0].toLowerCase();
    const user = data.users.find(u => u.username.toLowerCase() === username);
    return { rows: user ? [user] : [] };
  }

  // 2. Check if user already exists
  if (sql.includes('SELECT id FROM users WHERE LOWER(username) = $1')) {
    const username = params[0].toLowerCase();
    const user = data.users.find(u => u.username.toLowerCase() === username);
    return { rows: user ? [{ id: user.id }] : [] };
  }

  // 3. INSERT user
  if (sql.includes('INSERT INTO users (username, password_hash, role)')) {
    const newUser = {
      id: data.users.length + 1,
      username: params[0],
      password_hash: params[1],
      role: params[2],
      created_at: new Date().toISOString()
    };
    data.users.push(newUser);
    saveMockData(data);
    return { rows: [{ id: newUser.id, username: newUser.username, role: newUser.role }] };
  }

  // 4. SELECT creator username
  if (sql.includes('SELECT username FROM users WHERE id = $1')) {
    const user = data.users.find(u => u.id === params[0]);
    return { rows: user ? [{ username: user.username }] : [] };
  }

  // 5. SELECT all variables
  if (sql.includes('SELECT v.id, v.name, v.description, v.type, v.user_id')) {
    const rows = data.variables.map(v => {
      const creatorUser = data.users.find(u => u.id === v.user_id);
      const dataCount = data.data_records.filter(r => r.variable_id === v.id).length;
      return {
        id: v.id,
        name: v.name,
        description: v.description,
        type: v.type,
        user_id: v.user_id,
        creator: creatorUser ? creatorUser.username : 'Desconocido',
        created_at: v.created_at,
        data_count: dataCount
      };
    });
    // Sort by created_at DESC
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows };
  }

  // 6. INSERT variable
  if (sql.includes('INSERT INTO variables (name, description, type, user_id)')) {
    const newVar = {
      id: data.variables.length + 1,
      name: params[0],
      description: params[1],
      type: params[2],
      user_id: params[3],
      created_at: new Date().toISOString()
    };
    data.variables.push(newVar);
    saveMockData(data);
    return { rows: [newVar] };
  }

  // 7. Check variable type and ownership (handles both column orderings)
  if ((sql.includes('FROM variables WHERE id = $1') && !sql.includes('INSERT') && !sql.includes('UPDATE') && !sql.includes('DELETE') && !sql.includes('v.id, v.name'))) {
    const id = parseInt(params[0], 10);
    const variable = data.variables.find(v => v.id === id);
    return { rows: variable ? [variable] : [] };
  }

  // 8. UPDATE variable
  if (sql.includes('UPDATE variables SET name = $1')) {
    const name = params[0];
    const description = params[1];
    const type = params[2];
    const id = parseInt(params[3], 10);

    const idx = data.variables.findIndex(v => v.id === id);
    if (idx !== -1) {
      data.variables[idx].name = name;
      data.variables[idx].description = description;
      data.variables[idx].type = type;
      saveMockData(data);
      return { rows: [data.variables[idx]] };
    }
    return { rows: [] };
  }

  // 9. DELETE variable
  if (sql.includes('DELETE FROM variables WHERE id = $1')) {
    const id = parseInt(params[0], 10);
    data.variables = data.variables.filter(v => v.id !== id);
    data.data_records = data.data_records.filter(r => r.variable_id !== id);
    saveMockData(data);
    return { rows: [] };
  }

  // 10. SELECT data records for variable
  if (sql.includes('value::float as value, created_at FROM data_records WHERE variable_id = $1')) {
    const varId = parseInt(params[0], 10);
    const rows = data.data_records
      .filter(r => r.variable_id === varId)
      .map(r => ({
        id: r.id,
        variable_id: r.variable_id,
        value: parseFloat(r.value),
        created_at: r.created_at
      }));
    rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
    return { rows };
  }

  // 11. Check decimals in data_records
  if (sql.includes('SELECT COUNT(*)::int FROM data_records WHERE variable_id = $1 AND value % 1 <> 0')) {
    const varId = parseInt(params[0], 10);
    const count = data.data_records.filter(r => r.variable_id === varId && parseFloat(r.value) % 1 !== 0).length;
    return { rows: [{ count }] };
  }

  // 12. Count total records for variable
  if (sql.includes('SELECT COUNT(*)::int FROM data_records WHERE variable_id = $1')) {
    const varId = parseInt(params[0], 10);
    const count = data.data_records.filter(r => r.variable_id === varId).length;
    return { rows: [{ count }] };
  }

  // 13. INSERT data records (handles single/bulk)
  if (sql.includes('INSERT INTO data_records (variable_id, value)')) {
    const insertedRows = [];
    for (let i = 0; i < params.length; i += 2) {
      const varId = parseInt(params[i], 10);
      const val = parseFloat(params[i + 1]);
      const newRec = {
        id: data.data_records.length + 1,
        variable_id: varId,
        value: val,
        created_at: new Date().toISOString()
      };
      data.data_records.push(newRec);
      insertedRows.push({
        id: newRec.id,
        variable_id: newRec.variable_id,
        value: newRec.value,
        created_at: newRec.created_at
      });
    }
    saveMockData(data);
    return { rows: insertedRows };
  }

  // 14. SELECT record with variable properties (edit check or delete check)
  if (sql.includes('FROM data_records r') && sql.includes('JOIN variables v') && sql.includes('WHERE r.id = $1')) {
    const recId = parseInt(params[0], 10);
    const rec = data.data_records.find(r => r.id === recId);
    if (rec) {
      const variable = data.variables.find(v => v.id === rec.variable_id);
      return {
        rows: [{
          id: rec.id,
          variable_id: rec.variable_id,
          type: variable ? variable.type : 'continua',
          user_id: variable ? variable.user_id : null
        }]
      };
    }
    return { rows: [] };
  }

  // 15. UPDATE single data record
  if (sql.includes('UPDATE data_records SET value = $1 WHERE id = $2')) {
    const val = parseFloat(params[0]);
    const id = parseInt(params[1], 10);
    const idx = data.data_records.findIndex(r => r.id === id);
    if (idx !== -1) {
      data.data_records[idx].value = val;
      saveMockData(data);
      return { rows: [data.data_records[idx]] };
    }
    return { rows: [] };
  }

  // 16. DELETE single data record
  if (sql.includes('DELETE FROM data_records WHERE id = $1')) {
    const id = parseInt(params[0], 10);
    data.data_records = data.data_records.filter(r => r.id !== id);
    saveMockData(data);
    return { rows: [] };
  }

  // 17. DELETE all data records for variable
  if (sql.includes('DELETE FROM data_records WHERE variable_id = $1')) {
    const varId = parseInt(params[0], 10);
    data.data_records = data.data_records.filter(r => r.variable_id !== varId);
    saveMockData(data);
    return { rows: [] };
  }

  return { rows: [] };
}

// Attempt PostgreSQL initialization
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const hasEnvConfig = !!(connectionString || process.env.PGHOST);

if (hasEnvConfig) {
  try {
    const config = connectionString
      ? {
        connectionString,
        ssl: { rejectUnauthorized: false }
      }
      : {
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
      };

    pool = new Pool(config);

    // Check pool errors
    pool.on('error', (err) => {
      console.error('PostgreSQL client error:', err);
      enableMockFallback();
    });
  } catch (error) {
    console.error('POOL INIT ERROR:', error);
    throw error;
  }
} else {
  enableMockFallback();
}

function enableMockFallback() {
  if (!useMock) {
    console.log('===================================================');
    console.log('⚠️  ATENCIÓN: No se detectaron credenciales de base de datos.');
    console.log('💡  Usando base de datos simulada en "mock_database.json"');
    console.log('===================================================');
    useMock = true;
  }
}

// Export a wrapper that selects PostgreSQL pool or JSON mock logic dynamically
module.exports = {
  query: async (text, params) => {
    if (useMock) {
      return mockQuery(text, params);
    }
    try {
      return await pool.query(text, params);
    }
    catch (dbError) {
      console.error('POSTGRES ERROR:', dbError);
      throw dbError;
    }
  }
};

