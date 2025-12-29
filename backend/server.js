const express = require('express');
const { dbHelpers } = require('./database');
const { authenticateToken, JWT_SECRET } = require('./middleware');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('../frontend'));

// Endpoint testowy
app.get('/api', (req, res) => {
  res.json({
    message: 'API Backend z TOTP 2FA',
    endpoints: [
      'POST /api/register',
      'POST /api/login'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
