const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
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

// Logowanie użytkownika
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email i hasło są wymagane' });
    }

    // Znajdź użytkownika
    const user = await dbHelpers.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    }

    // Weryfikuj hasło
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    }

    // Jeśli TOTP włączone, wymagaj weryfikacji
    if (user.totp_enabled) {
      const tempToken = jwt.sign(
        { userId: user.id, email: user.email, tempAuth: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        message: 'Wymagana weryfikacja TOTP',
        tempToken,
        requiresTotp: true
      });
    }

    // Wygeneruj token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Setup TOTP - generowanie QR kodu
app.get('/api/setup-totp', authenticateToken, async (req, res) => {
  try {
    const user = await dbHelpers.get('SELECT * FROM users WHERE id = ?', [req.userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }

    // Generuj secret
    const secret = speakeasy.generateSecret({
      name: `BSI 2FA (${user.email})`
    });

    // Zapisz secret w bazie
    await dbHelpers.run(
      'UPDATE users SET totp_secret = ? WHERE id = ?',
      [secret.base32, user.id]
    );

    // Wygeneruj QR kod
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
