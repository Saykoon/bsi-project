# Aplikacja z autoryzacją 2FA (TOTP)

Kompletna aplikacja webowa z mechanizmem dwuskładnikowej autoryzacji wykorzystującą TOTP (Time-based One-Time Password).

## 🚀 Start

```bash
cd backend
npm install
node server.js
```

Aplikacja dostępna na http://localhost:3000

## Funkcjonalności

- **Rejestracja użytkowników** z walidacją danych
- **Logowanie dwuetapowe**:
  1. Weryfikacja hasła (hashowane z bcrypt)
  2. Weryfikacja kodu TOTP z aplikacji (np. Google Authenticator)
- **Zarządzanie danymi użytkownika** (CRUD) - notatki/zadania
- **Sesje z tokenami JWT** z czasem wygaśnięcia (TTL)
- **Bezpieczne API** z walidacją danych wejściowych

## Stos technologiczny

### Backend
- Node.js + Express
- SQLite (baza danych)
- bcrypt (hashowanie haseł)
- jsonwebtoken (JWT)
- speakeasy (generowanie i weryfikacja TOTP)
- qrcode (generowanie kodów QR dla TOTP)

### Frontend
- HTML5 + CSS3 + Vanilla JavaScript
- Responsywny interfejs użytkownika

## Struktura projektu

```
root/
├── backend/
│   ├── server.js           # Główny plik serwera
│   ├── database.js         # Konfiguracja bazy danych
│   ├── middleware.js       # Middleware autoryzacji
│   └── package.json        # Zależności backendu
├── frontend/
│   ├── index.html          # Główna strona aplikacji
│   ├── style.css           # Style
│   └── app.js              # Logika frontendu
├── README.md
└── .gitignore
```

## Instalacja i uruchomienie

### 1. Zainstaluj zależności backendu

```bash
cd backend
npm install
```

### 2. Uruchom serwer

```bash
npm start
```

Serwer będzie dostępny pod adresem: `http://localhost:3000`

### 3. Otwórz aplikację

Otwórz w przeglądarce: `http://localhost:3000`

## API Endpoints

### Autoryzacja

- `POST /api/register` - Rejestracja nowego użytkownika
- `POST /api/login` - Logowanie (weryfikacja hasła)
- `POST /api/verify-totp` - Weryfikacja kodu TOTP
- `POST /api/logout` - Wylogowanie
- `GET /api/setup-totp` - Konfiguracja 2FA (wymaga autoryzacji)
- `POST /api/enable-totp` - Aktywacja 2FA (wymaga autoryzacji)

### CRUD (wymaga autoryzacji)

- `GET /api/my-items` - Pobierz wszystkie elementy użytkownika
- `POST /api/my-items` - Dodaj nowy element
- `PUT /api/my-items/:id` - Edytuj element
- `DELETE /api/my-items/:id` - Usuń element

## Bezpieczeństwo

- ✅ Hasła hashowane z bcrypt
- ✅ Tokeny JWT z czasem wygaśnięcia (1 godzina)
- ✅ Sekret TOTP przechowywany bezpiecznie w bazie
- ✅ Walidacja danych wejściowych (email, długość pól)
- ✅ Ochrona przed pustymi wartościami
- ✅ Brak wrażliwych danych w odpowiedziach API
- ✅ Middleware sprawdzający autoryzację
- ✅ Odpowiednie kody HTTP (401, 403, 404, 500)

## Workflow TOTP 2FA

1. **Rejestracja**: Użytkownik tworzy konto z emailem i hasłem
2. **Konfiguracja 2FA**: 
   - Użytkownik loguje się hasłem
   - Klika "Włącz 2FA"
   - Skanuje kod QR w aplikacji Google Authenticator
   - Wprowadza kod weryfikacyjny
3. **Logowanie z 2FA**:
   - Wpisuje email i hasło
   - Wpisuje 6-cyfrowy kod z Google Authenticator
   - Otrzymuje dostęp do aplikacji

## Wersjonowanie

- Wersja: **v1.0**
- Minimum 20 commitów z czytelnymi opisami
- Minimum 1 Pull Request

## Autor

Projekt stworzony jako część zadania BSI.
