const jwt = require('jsonwebtoken');

const JWT_SECRET = 'a986d51410359e8aeecd3ed92c7272fe070bb921868821ba42390b0aec593e550c4a4d1a85e002ca86b89b5ba978d6be362b68b300dbe14dfad610a786b770be';

// Middleware autoryzacji JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Brak tokenu' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}

module.exports = { authenticateToken, JWT_SECRET };
