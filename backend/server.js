const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { dbHelpers } = require('./database');
const { authenticateToken, JWT_SECRET } = require('./middleware');

// Klucz szyfrowania TOTP (w produkcji: zmienna środowiskowa)
const ENCRYPTION_KEY = crypto.scryptSync('totp-encryption-key-2fa-bsi', 'salt', 32);
const ENCRYPTION_IV_LENGTH = 16;

function encryptTotpSecret(text) {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptTotpSecret(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function validatePassword(password) {
  if (password.length < 8) {
    return { valid: false, error: 'Hasło musi mieć minimum 8 znaków' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: 'Hasło musi zawierać przynajmniej jeden znak specjalny' };
  }
  return { valid: true };
}

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('../frontend'));

// CORS dla development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Endpoint testowy
app.get('/api', (req, res) => {
  res.json({
    message: 'API Backend z TOTP 2FA',
    endpoints: [
      'POST /api/register',
      'POST /api/login',
      'POST /api/verify-totp',
      'GET /api/setup-totp (auth)',
      'POST /api/enable-totp (auth)',
      'GET /api/me (auth)'
    ]
  });
});

// Informacje o użytkowniku
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbHelpers.get(
      'SELECT id, email, totp_enabled FROM users WHERE id = ?',
      [req.userId]
    );
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Rejestracja użytkownika
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email i hasło są wymagane' });
    }

    // Walidacja polityki hasła
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
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

    // Zaszyfruj i zapisz secret w bazie
    const encryptedSecret = encryptTotpSecret(secret.base32);
    await dbHelpers.run(
      'UPDATE users SET totp_secret = ? WHERE id = ?',
      [encryptedSecret, user.id]
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

// Włączenie TOTP - weryfikacja i aktywacja
app.post('/api/enable-totp', authenticateToken, async (req, res) => {
  try {
    const { totpCode } = req.body;

    if (!totpCode) {
      return res.status(400).json({ error: 'Kod TOTP jest wymagany' });
    }

    const user = await dbHelpers.get('SELECT * FROM users WHERE id = ?', [req.userId]);

    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: 'Najpierw skonfiguruj TOTP' });
    }

    // Odszyfruj secret i weryfikuj kod
    const decryptedSecret = decryptTotpSecret(user.totp_secret);
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: totpCode,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ error: 'Nieprawidłowy kod TOTP' });
    }

    // Włącz TOTP
    await dbHelpers.run('UPDATE users SET totp_enabled = 1 WHERE id = ?', [user.id]);

    res.json({ message: '2FA włączone pomyślnie' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Weryfikacja TOTP przy logowaniu
app.post('/api/verify-totp', async (req, res) => {
  try {
    const { tempToken, totpCode } = req.body;

    if (!tempToken || !totpCode) {
      return res.status(400).json({ error: 'Token i kod TOTP są wymagane' });
    }

    // Weryfikuj tempToken
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
      if (!decoded.tempAuth) {
        return res.status(401).json({ error: 'Nieprawidłowy token' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Token wygasł' });
    }

    const user = await dbHelpers.get('SELECT * FROM users WHERE id = ?', [decoded.userId]);

    if (!user || !user.totp_enabled) {
      return res.status(400).json({ error: 'TOTP nie jest włączone' });
    }

    // Odszyfruj secret i weryfikuj kod TOTP
    const decryptedSecret = decryptTotpSecret(user.totp_secret);
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: totpCode,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ error: 'Nieprawidłowy kod TOTP' });
    }

    // Wygeneruj finalny token
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

// CRUD - Lista notatek użytkownika (wymaga 2FA)
app.get('/api/my-items', authenticateToken, async (req, res) => {
  try {
    // Sprawdź czy użytkownik ma włączone 2FA
    const user = await dbHelpers.get('SELECT totp_enabled FROM users WHERE id = ?', [req.userId]);
    if (!user || !user.totp_enabled) {
      return res.status(403).json({ error: 'Dostęp do notatek wymaga włączenia 2FA' });
    }

    const items = await dbHelpers.all(
      'SELECT id, title, content, created_at FROM items WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// CRUD - Dodaj notatkę (wymaga 2FA)
app.post('/api/my-items', authenticateToken, async (req, res) => {
  try {
    // Sprawdź czy użytkownik ma włączone 2FA
    const user = await dbHelpers.get('SELECT totp_enabled FROM users WHERE id = ?', [req.userId]);
    if (!user || !user.totp_enabled) {
      return res.status(403).json({ error: 'Dodawanie notatek wymaga włączenia 2FA' });
    }

    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Tytuł jest wymagany' });
    }

    const result = await dbHelpers.run(
      'INSERT INTO items (user_id, title, content) VALUES (?, ?, ?)',
      [req.userId, title, content || '']
    );

    res.status(201).json({
      id: result.lastID,
      title,
      content: content || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// CRUD - Edytuj notatkę (wymaga 2FA)
app.put('/api/my-items/:id', authenticateToken, async (req, res) => {
  try {
    // Sprawdź czy użytkownik ma włączone 2FA
    const user = await dbHelpers.get('SELECT totp_enabled FROM users WHERE id = ?', [req.userId]);
    if (!user || !user.totp_enabled) {
      return res.status(403).json({ error: 'Edycja notatek wymaga włączenia 2FA' });
    }

    const { id } = req.params;
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Tytuł jest wymagany' });
    }

    // Sprawdź czy notatka należy do użytkownika
    const item = await dbHelpers.get(
      'SELECT * FROM items WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!item) {
      return res.status(404).json({ error: 'Notatka nie znaleziona' });
    }

    await dbHelpers.run(
      'UPDATE items SET title = ?, content = ? WHERE id = ?',
      [title, content || '', id]
    );

    res.json({ message: 'Notatka zaktualizowana' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// CRUD - Usuń notatkę (wymaga 2FA)
app.delete('/api/my-items/:id', authenticateToken, async (req, res) => {
  try {
    // Sprawdź czy użytkownik ma włączone 2FA
    const user = await dbHelpers.get('SELECT totp_enabled FROM users WHERE id = ?', [req.userId]);
    if (!user || !user.totp_enabled) {
      return res.status(403).json({ error: 'Usuwanie notatek wymaga włączenia 2FA' });
    }

    const { id } = req.params;

    // Sprawdź czy notatka należy do użytkownika
    const item = await dbHelpers.get(
      'SELECT * FROM items WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!item) {
      return res.status(404).json({ error: 'Notatka nie znaleziona' });
    }

    await dbHelpers.run('DELETE FROM items WHERE id = ?', [id]);

    res.json({ message: 'Notatka usunięta' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
