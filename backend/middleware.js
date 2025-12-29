const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-secret-key-change-in-production-2024';

// Middleware sprawdzający autoryzację
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Sprawdź czy token nie wygasł
    if (decoded.exp * 1000 < Date.now()) {
      return res.status(401).json({ error: 'Token wygasł' });
    }

    req.userId = decoded.userId;
    req.email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}

// Funkcja generująca token JWT
function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '1h' } // Token ważny 1 godzinę (TTL)
  );
}

module.exports = {
  authenticateToken,
  generateToken,
  JWT_SECRET
};
