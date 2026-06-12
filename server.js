const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON body parsing
app.use(express.json({ limit: '10mb' }));

// Serve frontend assets
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

// Import Vercel API Handlers
const registerHandler = require('./api/auth/register');
const loginHandler = require('./api/auth/login');
const meHandler = require('./api/auth/me');
const variablesHandler = require('./api/variables');
const dataHandler = require('./api/data');

// Wrapper to standardise req/res logic and catch crashes
const handle = (handler) => async (req, res) => {
  try {
    // Vercel environment automatically injects query parameters, body, etc.
    // Express already handles these via req.query and req.body.
    await handler(req, res);
  } catch (error) {
    console.error('Server error inside handler:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  }
};

// Routing for APIs
app.all('/api/auth/register', handle(registerHandler));
app.all('/api/auth/login', handle(loginHandler));
app.all('/api/auth/me', handle(meHandler));
app.all('/api/variables', handle(variablesHandler));
app.all('/api/data', handle(dataHandler));

// Start the server
app.listen(PORT, () => {
  console.log('===================================================');
  console.log(` Servidor local de simulación iniciado con éxito.`);
  console.log(` Navega a: http://localhost:${PORT}`);
  console.log('===================================================');
});
