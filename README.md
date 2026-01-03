# BSI - Projekt autoryzacji 2FA

Projekt z implementacją dwuskładnikowej autoryzacji TOTP.

## 🚀 Technologie

- **Backend:** Node.js, Express, SQLite
- **Autoryzacja:** JWT, bcrypt, TOTP (speakeasy)
- **Frontend:** Vanilla HTML/CSS/JavaScript

## 📦 Instalacja

```bash
cd backend
npm install
node server.js
```

Aplikacja: http://localhost:3000

## 🔐 Funkcjonalności

- Rejestracja i logowanie użytkowników
- Dwuskładnikowa autoryzacja TOTP (Google Authenticator)
- CRUD operacje na notatkach użytkownika
- Ochrona endpointów JWT
- Hashowanie haseł bcrypt

## 📚 API Endpoints

### Autoryzacja
- `POST /api/register` - Rejestracja
- `POST /api/login` - Logowanie
- `POST /api/verify-totp` - Weryfikacja TOTP

### 2FA
- `GET /api/setup-totp` - Generowanie QR
- `POST /api/enable-totp` - Aktywacja 2FA

### Notatki (wymagają JWT)
- `GET /api/my-items` - Lista
- `POST /api/my-items` - Dodaj
- `PUT /api/my-items/:id` - Edytuj
- `DELETE /api/my-items/:id` - Usuń

## 👤 Autor

Artūr Banevskij (a.banewskij1@gmail.com)
