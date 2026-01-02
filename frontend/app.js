// ===== KONFIGURACJA =====
const API_URL = 'http://localhost:3000/api';
let currentToken = localStorage.getItem('token');
let currentUser = null;
let tempToken = null; // Token tymczasowy do weryfikacji TOTP

// ===== INICJALIZACJA =====
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  if (currentToken) {
    checkAuth();
  } else {
    showSection('loginSection');
  }
});

// ===== OBSŁUGA ZDARZEŃ =====
function setupEventListeners() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('totpVerifyForm').addEventListener('submit', handleTotpVerify);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('totpEnableForm').addEventListener('submit', handleTotpEnable);
  document.getElementById('itemForm').addEventListener('submit', handleItemSubmit);
}

// ===== NAWIGACJA =====
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
  
  // Wyczyść komunikaty
  clearMessages();
}

function clearMessages() {
  const messageIds = ['loginMessage', 'totpVerifyMessage', 'registerMessage', 'totpSetupMessage', 'itemsMessage', 'itemModalMessage'];
  messageIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  el.innerHTML = `<div class="message ${type}">${message}</div>`;
}

// ===== AUTORYZACJA =====
async function checkAuth() {
  try {
    const response = await fetch(`${API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (response.ok) {
      currentUser = await response.json();
      showAppSection();
    } else {
      localStorage.removeItem('token');
      currentToken = null;
      showSection('loginSection');
    }
  } catch (error) {
    console.error('Błąd autoryzacji:', error);
    showSection('loginSection');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('loginMessage', data.error || 'Błąd logowania', 'error');
      return;
    }

    // Jeśli wymaga TOTP
    if (data.requireTotp) {
      tempToken = data.tempToken;
      showSection('totpVerifySection');
      showMessage('totpVerifyMessage', data.message, 'info');
      document.getElementById('totpVerifyCode').focus();
    } else {
      // Logowanie bez TOTP
      currentToken = data.token;
      localStorage.setItem('token', currentToken);
      await checkAuth();
    }
  } catch (error) {
    console.error('Błąd logowania:', error);
    showMessage('loginMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

async function handleTotpVerify(e) {
  e.preventDefault();
  
  const totpCode = document.getElementById('totpVerifyCode').value;

  try {
    const response = await fetch(`${API_URL}/verify-totp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tempToken}`
      },
      body: JSON.stringify({ totpCode })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('totpVerifyMessage', data.error || 'Nieprawidłowy kod TOTP', 'error');
      return;
    }

    // Zapisz token i zaloguj
    currentToken = data.token;
    localStorage.setItem('token', currentToken);
    tempToken = null;
    document.getElementById('totpVerifyCode').value = '';
    
    await checkAuth();
  } catch (error) {
    console.error('Błąd weryfikacji TOTP:', error);
    showMessage('totpVerifyMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

  if (password !== passwordConfirm) {
    showMessage('registerMessage', 'Hasła nie są identyczne', 'error');
    return;
  }

  if (password.length < 8) {
    showMessage('registerMessage', 'Hasło musi mieć minimum 8 znaków', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('registerMessage', data.error || 'Błąd rejestracji', 'error');
      return;
    }

    showMessage('registerMessage', 'Rejestracja zakończona pomyślnie! Możesz się teraz zalogować.', 'success');
    
    // Wyczyść formularz
    document.getElementById('registerForm').reset();
    
    // Przejdź do logowania po 2 sekundach
    setTimeout(() => {
      showSection('loginSection');
      showMessage('loginMessage', 'Możesz się teraz zalogować', 'success');
    }, 2000);
  } catch (error) {
    console.error('Błąd rejestracji:', error);
    showMessage('registerMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

function logout() {
  localStorage.removeItem('token');
  currentToken = null;
  currentUser = null;
  tempToken = null;
  
  // Wyczyść formularze
  document.getElementById('loginForm').reset();
  document.getElementById('totpVerifyForm').reset();
  
  showSection('loginSection');
  showMessage('loginMessage', 'Wylogowano pomyślnie', 'success');
}

// ===== WIDOK APLIKACJI =====
function showAppSection() {
  document.getElementById('currentUserEmail').textContent = currentUser.email;
  
  // Pokaż status TOTP
  const totpBadge = document.getElementById('totpStatusBadge');
  if (currentUser.totpEnabled) {
    totpBadge.innerHTML = '<span class="badge badge-success">2FA Włączone ✓</span>';
    document.getElementById('totpSetupContainer').style.display = 'none';
  } else {
    totpBadge.innerHTML = '<span class="badge badge-warning">2FA Wyłączone</span>';
    document.getElementById('totpSetupContainer').style.display = 'block';
  }
  
  showSection('appSection');
  loadItems();
}

// ===== KONFIGURACJA TOTP =====
async function setupTotp() {
  document.getElementById('totpSetupModal').classList.add('active');
  document.getElementById('totpSetupLoader').classList.add('active');
  document.getElementById('totpSetupStep1').style.display = 'none';
  
  try {
    const response = await fetch(`${API_URL}/setup-totp`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('totpSetupMessage', data.error || 'Błąd konfiguracji TOTP', 'error');
      document.getElementById('totpSetupLoader').classList.remove('active');
      return;
    }

    // Wyświetl QR code i sekret
    document.getElementById('totpQrCode').src = data.qrCode;
    document.getElementById('totpSecretKey').textContent = data.secret;
    
    document.getElementById('totpSetupLoader').classList.remove('active');
    document.getElementById('totpSetupStep1').style.display = 'block';
    
  } catch (error) {
    console.error('Błąd konfiguracji TOTP:', error);
    showMessage('totpSetupMessage', 'Błąd połączenia z serwerem', 'error');
    document.getElementById('totpSetupLoader').classList.remove('active');
  }
}

async function handleTotpEnable(e) {
  e.preventDefault();
  
  const totpCode = document.getElementById('totpEnableCode').value;

  try {
    const response = await fetch(`${API_URL}/enable-totp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ totpCode })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('totpSetupMessage', data.error || 'Nieprawidłowy kod TOTP', 'error');
      return;
    }

    showMessage('totpSetupMessage', '✓ 2FA włączone pomyślnie!', 'success');
    
    // Odśwież status użytkownika
    setTimeout(async () => {
      await checkAuth();
      closeTotpSetupModal();
    }, 1500);
    
  } catch (error) {
    console.error('Błąd włączania TOTP:', error);
    showMessage('totpSetupMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

function closeTotpSetupModal() {
  document.getElementById('totpSetupModal').classList.remove('active');
  document.getElementById('totpEnableForm').reset();
  document.getElementById('totpSetupStep1').style.display = 'none';
  clearMessages();
}

// ===== ZARZĄDZANIE ELEMENTAMI (CRUD) =====
async function loadItems() {
  const loader = document.getElementById('itemsLoader');
  const itemsList = document.getElementById('itemsList');
  
  loader.classList.add('active');
  itemsList.innerHTML = '';

  try {
    const response = await fetch(`${API_URL}/my-items`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }

    const data = await response.json();
    loader.classList.remove('active');

    if (!response.ok) {
      showMessage('itemsMessage', data.error || 'Błąd pobierania elementów', 'error');
      return;
    }

    if (data.items.length === 0) {
      itemsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>Nie masz jeszcze żadnych notatek</p>
          <p>Kliknij "Dodaj notatkę" aby utworzyć pierwszą</p>
        </div>
      `;
      return;
    }

    // Wyświetl elementy
    itemsList.innerHTML = data.items.map(item => `
      <div class="item-card">
        <div class="item-header">
          <div>
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="item-date">${formatDate(item.created_at)}</div>
          </div>
        </div>
        <div class="item-content">${escapeHtml(item.content || 'Brak treści')}</div>
        <div class="item-actions">
          <button class="btn btn-primary" onclick="openEditItemModal(${item.id})">Edytuj</button>
          <button class="btn btn-danger" onclick="deleteItem(${item.id})">Usuń</button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Błąd pobierania elementów:', error);
    loader.classList.remove('active');
    showMessage('itemsMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

function openAddItemModal() {
  document.getElementById('itemModalTitle').textContent = 'Dodaj notatkę';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemModal').classList.add('active');
  clearMessages();
}

async function openEditItemModal(itemId) {
  try {
    const response = await fetch(`${API_URL}/my-items`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await response.json();
    const item = data.items.find(i => i.id === itemId);

    if (item) {
      document.getElementById('itemModalTitle').textContent = 'Edytuj notatkę';
      document.getElementById('itemId').value = item.id;
      document.getElementById('itemTitle').value = item.title;
      document.getElementById('itemContent').value = item.content || '';
      document.getElementById('itemModal').classList.add('active');
      clearMessages();
    }
  } catch (error) {
    console.error('Błąd pobierania elementu:', error);
  }
}

async function handleItemSubmit(e) {
  e.preventDefault();
  
  const itemId = document.getElementById('itemId').value;
  const title = document.getElementById('itemTitle').value;
  const content = document.getElementById('itemContent').value;

  const method = itemId ? 'PUT' : 'POST';
  const url = itemId ? `${API_URL}/my-items/${itemId}` : `${API_URL}/my-items`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ title, content })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('itemModalMessage', data.error || 'Błąd zapisu', 'error');
      return;
    }

    closeItemModal();
    showMessage('itemsMessage', itemId ? 'Notatka zaktualizowana' : 'Notatka dodana', 'success');
    loadItems();

  } catch (error) {
    console.error('Błąd zapisu elementu:', error);
    showMessage('itemModalMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

async function deleteItem(itemId) {
  if (!confirm('Czy na pewno chcesz usunąć tę notatkę?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/my-items/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('itemsMessage', data.error || 'Błąd usuwania', 'error');
      return;
    }

    showMessage('itemsMessage', 'Notatka usunięta', 'success');
    loadItems();

  } catch (error) {
    console.error('Błąd usuwania elementu:', error);
    showMessage('itemsMessage', 'Błąd połączenia z serwerem', 'error');
  }
}

function closeItemModal() {
  document.getElementById('itemModal').classList.remove('active');
  document.getElementById('itemForm').reset();
  clearMessages();
}

// ===== FUNKCJE POMOCNICZE =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
