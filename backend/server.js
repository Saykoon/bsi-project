const express = require('express');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const { authenticateToken, generateToken } = require('./middleware');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== WALIDACJA =====
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8 && password.length <= 100;
}

function validateString(str, minLen = 1, maxLen = 1000) {
  return str && typeof str === 'string' && str.trim().length >= minLen && str.length <= maxLen;
}

// ===== ENDPOINTS AUTORYZACJI =====

// Dokumentacja API
app.get('/api', (req, res) => {
  res.json({
    message: 'BSI TOTP 2FA API',
    version: 'v1.0',
    endpoints: {
      authentication: {
        'POST /api/register': {
          description: 'Rejestracja nowego użytkownika',
          body: { email: 'string', password: 'string (min 8 znaków)' },
          response: { userId: 'number', message: 'string' }
        },
        'POST /api/login': {
          description: 'Logowanie użytkownika (krok 1 - weryfikacja hasła)',
          body: { email: 'string', password: 'string' },
          response: { token: 'string', requireTotp: 'boolean', tempToken: 'string (jeśli TOTP włączony)' }
        },
        'POST /api/verify-totp': {
          description: 'Weryfikacja kodu TOTP (krok 2 - po logowaniu)',
          headers: { Authorization: 'Bearer {token}' },
          body: { totpCode: 'string (6 cyfr)' },
          response: { token: 'string', email: 'string', totpEnabled: 'boolean' }
        },
        'GET /api/setup-totp': {
          description: 'Konfiguracja 2FA - generowanie QR code',
          headers: { Authorization: 'Bearer {token}' },
          response: { secret: 'string', qrCode: 'string (base64)' }
        },
        'POST /api/enable-totp': {
          description: 'Włączenie 2FA po weryfikacji kodu',
          headers: { Authorization: 'Bearer {token}' },
          body: { totpCode: 'string (6 cyfr)' },
          response: { message: 'string' }
        },
        'POST /api/disable-totp': {
          description: 'Wyłączenie 2FA',
          headers: { Authorization: 'Bearer {token}' },
          body: { totpCode: 'string (6 cyfr)' },
          response: { message: 'string' }
        },
        'POST /api/logout': {
          description: 'Wylogowanie użytkownika',
          headers: { Authorization: 'Bearer {token}' },
          response: { message: 'string' }
        },
        'GET /api/me': {
          description: 'Informacje o zalogowanym użytkowniku',
          headers: { Authorization: 'Bearer {token}' },
          response: { id: 'number', email: 'string', totpEnabled: 'boolean' }
        }
      },
      items: {
        'GET /api/my-items': {
          description: 'Pobierz wszystkie notatki użytkownika',
          headers: { Authorization: 'Bearer {token}' },
          response: { items: '[Array of items]' }
        },
        'POST /api/my-items': {
          description: 'Dodaj nową notatkę',
          headers: { Authorization: 'Bearer {token}' },
          body: { title: 'string (1-200 znaków)', content: 'string (0-5000 znaków)' },
          response: { item: 'object', message: 'string' }
        },
        'PUT /api/my-items/:id': {
          description: 'Zaktualizuj notatkę',
          headers: { Authorization: 'Bearer {token}' },
          body: { title: 'string', content: 'string' },
          response: { item: 'object', message: 'string' }
        },
        'DELETE /api/my-items/:id': {
          description: 'Usuń notatkę',
          headers: { Authorization: 'Bearer {token}' },
          response: { message: 'string' }
        }
      }
    },
    security: {
      authentication: 'JWT Bearer Token',
      tokenExpiration: '1 hour',
      passwordHashing: 'bcrypt',
      totpAlgorithm: 'TOTP (Time-based One-Time Password)'
    },
    notes: [
      'Wszystkie endpointy z "/api/my-items" oraz konfiguracja TOTP wymagają autoryzacji',
      'Token JWT należy przesyłać w nagłówku: Authorization: Bearer {token}',
      'Hasła muszą mieć minimum 8 znaków',
      'Email musi być w prawidłowym formacie',
      'Kody TOTP składają się z 6 cyfr'
    ]
  });
});

// Rejestracja użytkownika
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Walidacja
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Nieprawidłowy format email' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Hasło musi mieć od 8 do 100 znaków' });
    }

    // Sprawdź czy użytkownik już istnieje
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik z tym emailem już istnieje' });
    }

    // Hashuj hasło
    const passwordHash = await bcrypt.hash(password, 10);

    // Dodaj użytkownika do bazy
    const result = await db.run(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );

    res.status(201).json({
      message: 'Użytkownik zarejestrowany pomyślnie',
      userId: result.lastID
    });

  } catch (error) {
    console.error('Błąd rejestracji:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Logowanie - krok 1: weryfikacja hasła
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Walidacja
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Nieprawidłowy format email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Hasło jest wymagane' });
    }

    // Znajdź użytkownika
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Sprawdź hasło
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Jeśli użytkownik ma włączony TOTP, wymagaj weryfikacji
    if (user.totp_enabled) {
      // Generuj tymczasowy token do weryfikacji TOTP
      const tempToken = generateToken(user.id, user.email);
      
      return res.json({
        requireTotp: true,
        tempToken,
        message: 'Wprowadź kod z aplikacji Authenticator'
      });
    }

    // Jeśli TOTP nie jest włączony, zaloguj od razu
    const token = generateToken(user.id, user.email);

    res.json({
      token,
      email: user.email,
      totpEnabled: false,
      message: 'Zalogowano pomyślnie'
    });

  } catch (error) {
    console.error('Błąd logowania:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Logowanie - krok 2: weryfikacja kodu TOTP
app.post('/api/verify-totp', authenticateToken, async (req, res) => {
  try {
    const { totpCode } = req.body;

    if (!totpCode || !/^\d{6}$/.test(totpCode)) {
      return res.status(400).json({ error: 'Kod TOTP musi składać się z 6 cyfr' });
    }

    // Pobierz dane użytkownika
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);

    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(403).json({ error: 'TOTP nie jest włączony dla tego użytkownika' });
    }

    // Weryfikuj kod TOTP
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totpCode,
      window: 1 // Pozwól na 1 okres przed i po
    });

    if (!verified) {
      return res.status(401).json({ error: 'Nieprawidłowy kod TOTP' });
    }

    // Wygeneruj pełny token dostępu
    const token = generateToken(user.id, user.email);

    res.json({
      token,
      email: user.email,
      totpEnabled: true,
      message: 'Zalogowano pomyślnie z 2FA'
    });

  } catch (error) {
    console.error('Błąd weryfikacji TOTP:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Konfiguracja TOTP - generowanie sekretu i QR code
app.get('/api/setup-totp', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }

    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA jest już włączone' });
    }

    // Generuj nowy sekret TOTP
    const secret = speakeasy.generateSecret({
      name: `BSI App (${user.email})`,
      issuer: 'BSI TOTP App'
    });

    // Zapisz tymczasowo sekret (będzie potwierdzony przy enable-totp)
    await db.run('UPDATE users SET totp_secret = ? WHERE id = ?', [secret.base32, user.id]);

    // Generuj QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      message: 'Zeskanuj kod QR w aplikacji Google Authenticator'
    });

  } catch (error) {
    console.error('Błąd konfiguracji TOTP:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Włączenie TOTP - weryfikacja i aktywacja
app.post('/api/enable-totp', authenticateToken, async (req, res) => {
  try {
    const { totpCode } = req.body;

    if (!totpCode || !/^\d{6}$/.test(totpCode)) {
      return res.status(400).json({ error: 'Kod TOTP musi składać się z 6 cyfr' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);

    if (!user || !user.totp_secret) {
      return res.status(400).json({ error: 'Najpierw skonfiguruj TOTP' });
    }

    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA jest już włączone' });
    }

    // Weryfikuj kod TOTP
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totpCode,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ error: 'Nieprawidłowy kod TOTP. Sprawdź czas w urządzeniu.' });
    }

    // Aktywuj TOTP
    await db.run('UPDATE users SET totp_enabled = 1 WHERE id = ?', [user.id]);

    res.json({ message: '2FA włączone pomyślnie' });

  } catch (error) {
    console.error('Błąd włączania TOTP:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Wyłączenie TOTP
app.post('/api/disable-totp', authenticateToken, async (req, res) => {
  try {
    const { totpCode } = req.body;

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);

    if (!user || !user.totp_enabled) {
      return res.status(400).json({ error: '2FA nie jest włączone' });
    }

    // Weryfikuj kod przed wyłączeniem
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totpCode,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ error: 'Nieprawidłowy kod TOTP' });
    }

    // Wyłącz TOTP
    await db.run('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [req.userId]);

    res.json({ message: '2FA wyłączone pomyślnie' });

  } catch (error) {
    console.error('Błąd wyłączania TOTP:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Wylogowanie
app.post('/api/logout', authenticateToken, (req, res) => {
  // W JWT nie przechowujemy sesji po stronie serwera
  // Klient usuwa token
  res.json({ message: 'Wylogowano pomyślnie' });
});

// Sprawdź status użytkownika
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, email, totp_enabled FROM users WHERE id = ?', [req.userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }

    res.json({
      id: user.id,
      email: user.email,
      totpEnabled: Boolean(user.totp_enabled)
    });
  } catch (error) {
    console.error('Błąd pobierania użytkownika:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// ===== CRUD ENDPOINTS (chronione) =====

// GET - Pobierz wszystkie elementy użytkownika
app.get('/api/my-items', authenticateToken, async (req, res) => {
  try {
    const items = await db.all(
      'SELECT id, title, content, created_at, updated_at FROM items WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );

    res.json({ items });
  } catch (error) {
    console.error('Błąd pobierania elementów:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// POST - Dodaj nowy element
app.post('/api/my-items', authenticateToken, async (req, res) => {
  try {
    const { title, content } = req.body;

    // Walidacja
    if (!validateString(title, 1, 200)) {
      return res.status(400).json({ error: 'Tytuł musi mieć od 1 do 200 znaków' });
    }

    if (content && !validateString(content, 0, 5000)) {
      return res.status(400).json({ error: 'Treść może mieć maksymalnie 5000 znaków' });
    }

    const result = await db.run(
      'INSERT INTO items (user_id, title, content) VALUES (?, ?, ?)',
      [req.userId, title.trim(), content ? content.trim() : '']
    );

    const newItem = await db.get('SELECT * FROM items WHERE id = ?', [result.lastID]);

    res.status(201).json({
      message: 'Element dodany pomyślnie',
      item: newItem
    });
  } catch (error) {
    console.error('Błąd dodawania elementu:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// PUT - Edytuj element
app.put('/api/my-items/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { title, content } = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID elementu' });
    }

    // Walidacja
    if (!validateString(title, 1, 200)) {
      return res.status(400).json({ error: 'Tytuł musi mieć od 1 do 200 znaków' });
    }

    if (content && !validateString(content, 0, 5000)) {
      return res.status(400).json({ error: 'Treść może mieć maksymalnie 5000 znaków' });
    }

    // Sprawdź czy element należy do użytkownika
    const item = await db.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [itemId, req.userId]);

    if (!item) {
      return res.status(404).json({ error: 'Element nie znaleziony' });
    }

    // Aktualizuj element
    await db.run(
      'UPDATE items SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title.trim(), content ? content.trim() : '', itemId]
    );

    const updatedItem = await db.get('SELECT * FROM items WHERE id = ?', [itemId]);

    res.json({
      message: 'Element zaktualizowany pomyślnie',
      item: updatedItem
    });
  } catch (error) {
    console.error('Błąd aktualizacji elementu:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// DELETE - Usuń element
app.delete('/api/my-items/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID elementu' });
    }

    // Sprawdź czy element należy do użytkownika
    const item = await db.get('SELECT * FROM items WHERE id = ? AND user_id = ?', [itemId, req.userId]);

    if (!item) {
      return res.status(404).json({ error: 'Element nie znaleziony' });
    }

    // Usuń element
    await db.run('DELETE FROM items WHERE id = ?', [itemId]);

    res.json({ message: 'Element usunięty pomyślnie' });
  } catch (error) {
    console.error('Błąd usuwania elementu:', error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// Główna strona - obsługa przez frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start serwera
app.listen(PORT, () => {
  console.log(`✓ Serwer działa na http://localhost:${PORT}`);
  console.log(`✓ API dostępne na http://localhost:${PORT}/api`);
});
