# Dokumentacja API

## Przegląd
REST API z autoryzacją JWT i TOTP 2FA.

**Base URL:** `http://localhost:3000/api`

---

## Autoryzacja

### POST /register
Rejestracja nowego użytkownika.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "haslo123"
}
```

**Response (201):**
```json
{
  "message": "Użytkownik zarejestrowany",
  "userId": 1
}
```

---

### POST /login
Logowanie użytkownika.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "haslo123"
}
```

**Response (200) - bez TOTP:**
```json
{
  "token": "jwt_token...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

**Response (200) - z TOTP:**
```json
{
  "message": "Wymagana weryfikacja TOTP",
  "tempToken": "temp_jwt...",
  "requiresTotp": true
}
```

---

### POST /verify-totp
Weryfikacja kodu TOTP po logowaniu.

**Request:**
```json
{
  "tempToken": "temp_jwt...",
  "totpCode": "123456"
}
```

**Response (200):**
```json
{
  "token": "jwt_token...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

---

## TOTP 2FA

### GET /setup-totp
Generowanie QR kodu dla konfiguracji TOTP.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

---

### POST /enable-totp
Aktywacja TOTP po zeskanowaniu QR.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "totpCode": "123456"
}
```

**Response (200):**
```json
{
  "message": "2FA włączone pomyślnie"
}
```

---

## Dane użytkownika

### GET /me
Informacje o zalogowanym użytkowniku.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "totp_enabled": 1
}
```

---

## CRUD Notatki

### GET /my-items
Lista wszystkich notatek użytkownika.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Notatka 1",
    "content": "Treść...",
    "created_at": "2026-01-03T10:00:00"
  }
]
```

---

### POST /my-items
Dodanie nowej notatki.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "title": "Nowa notatka",
  "content": "Treść notatki"
}
```

**Response (201):**
```json
{
  "id": 2,
  "title": "Nowa notatka",
  "content": "Treść notatki"
}
```

---

### PUT /my-items/:id
Edycja istniejącej notatki.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "title": "Zaktualizowana notatka",
  "content": "Nowa treść"
}
```

**Response (200):**
```json
{
  "message": "Notatka zaktualizowana"
}
```

---

### DELETE /my-items/:id
Usunięcie notatki.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "message": "Notatka usunięta"
}
```

---

## Kody błędów

| Kod | Opis |
|-----|------|
| 400 | Nieprawidłowe dane wejściowe |
| 401 | Brak autoryzacji / Nieprawidłowy token |
| 404 | Zasób nie znaleziony |
| 500 | Błąd serwera |

---

## Bezpieczeństwo

- **Hasła:** Hashowane bcrypt (10 rund)
- **JWT:** Tokeny z TTL 1h
- **TOTP:** Window 2 (±60s)
- **CORS:** Włączone dla development
