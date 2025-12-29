const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Połączenie z bazą danych
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
  } else {
    console.log('Połączono z bazą SQLite');
  }
});

// Tabela użytkowników
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
