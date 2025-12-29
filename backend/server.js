const express = require('express');
const bcrypt = require('bcrypt');
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

// Rejestracja użytkownika
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email i hasło są wymagane' });
    }

    // Sprawdź czy użytkownik istnieje
    const existingUser = await dbHelpers.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik już istnieje' });
    }

    // Hashuj hasło
    const hashedPassword = await bcrypt.hash(password, 10);

    // Dodaj użytkownika
    const result = await dbHelpers.run(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );

    res.status(201).json({
      message: 'Użytkownik zarejestrowany',
      userId: result.lastID
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
