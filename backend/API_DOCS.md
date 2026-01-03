# Dokumentacja API

## Przegląd
Backend aplikacji z autoryzacją TOTP 2FA.

## Endpointy

### Autoryzacja

#### POST /api/register
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

#### POST /api/login
Logowanie użytkownika.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "haslo123"
}
```

**Response (200):**
```json
{
  "message": "Zalogowano, potrzebna weryfikacja TOTP",
  "tempToken": "temp_token_xyz",
  "requiresTotp": true
}
```

#### POST /api/verify-totp
Weryfikacja kodu TOTP.

**Request:**
```json
{
  "tempToken": "temp_token_xyz",
  "totpCode": "123456"
}
```

**Response (200):**
```json
{
  "token": "jwt_token_xyz",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

### TOTP 2FA

#### GET /api/setup-totp
Konfiguracja TOTP (wymaga tokenu JWT).

**Headers:**
```
Authorization: Bearer jwt_token_xyz
```

**Response (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

#### POST /api/enable-totp
Włączenie TOTP (wymaga tokenu JWT).

**Headers:**
```
Authorization: Bearer jwt_token_xyz
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
  "message": "2FA włączone"
}
```

### Dane użytkownika

#### GET /api/me
Informacje o zalogowanym użytkowniku.

**Headers:**
```
Authorization: Bearer jwt_token_xyz
```

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "totpEnabled": true
}
```

### CRUD Notatki

#### GET /api/my-items
Lista notatek użytkownika.

**Headers:**
```
Authorization: Bearer jwt_token_xyz
```

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Notatka 1",
    "content": "Treść notatki"
  }
]
```

#### POST /api/my-items
Dodanie nowej notatki.

**Headers:**
```
Authorization: Bearer jwt_token_xyz
```

**Request:**
```json
{
  "title": "Nowa notatka",
  "content": "Treść"
}
```

**Response (201):**
```json
{
  "id": 2,
  "title": "Nowa notatka",
  "content": "Treść"
}
```

#### PUT /api/my-items/:id
Edycja notatki.

**Headers:**
```
Authorization: Bearer jwt_token_xyz
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
  "message": "Zaktualizowano"
}
```

#### DELETE /api/my-items/:id
Usunięcie notatki.

**Headers:**
```
Authorization: Bearer jwt_token_xyz
```

**Response (200):**
```json
{
  "message": "Usunięto"
}
```

## Kody błędów

- **400** - Nieprawidłowe dane
- **401** - Brak autoryzacji
- **403** - Brak uprawnień
- **404** - Nie znaleziono
- **500** - Błąd serwera

## Bezpieczeństwo

- Hasła hashowane bcrypt (10 rund)
- Tokeny JWT z czasem wygaśnięcia (1h)
- TOTP z oknem 30s
- Walidacja wszystkich danych wejściowych