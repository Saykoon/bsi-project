const API_URL = 'http://localhost:3000/api';

let token = localStorage.getItem('token');
let tempToken = null;
let currentEditId = null;

// Elementy DOM
const authPanel = document.getElementById('authPanel');
const totpPanel = document.getElementById('totpPanel');
const mainPanel = document.getElementById('mainPanel');

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    if (token) {
        loadUserData();
    }
});

// Event listeners
function setupEventListeners() {
    // Zakładki
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab));
    });

    // Formularze
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('totpForm').addEventListener('submit', handleTotpVerify);
    
    // Przyciski
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('addItemBtn').addEventListener('click', () => openItemModal());
    document.getElementById('setupTotpBtn').addEventListener('click', setupTotp);
    document.getElementById('enableTotpBtn').addEventListener('click', enableTotp);
    document.getElementById('saveItemBtn').addEventListener('click', saveItem);
    document.getElementById('closeQrBtn').addEventListener('click', () => closeModal('qrModal'));
    document.getElementById('closeItemBtn').addEventListener('click', () => closeModal('itemModal'));
}

// Przełączanie zakładek
function switchTab(clickedTab) {
    const tabName = clickedTab.dataset.tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    clickedTab.classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Rejestracja
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    // Walidacja powtórzenia hasła
    if (password !== passwordConfirm) {
        alert('Hasła nie są identyczne!');
        return;
    }

    if (password.length < 6) {
        alert('Hasło musi mieć minimum 6 znaków');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Rejestracja udana! Możesz się zalogować.');
            document.querySelector('.tab[data-tab="login"]').click();
            document.getElementById('registerForm').reset();
        } else {
            alert(data.error || 'Błąd rejestracji');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Logowanie
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            if (data.requiresTotp) {
                tempToken = data.tempToken;
                showPanel('totpPanel');
            } else {
                token = data.token;
                localStorage.setItem('token', token);
                loadUserData();
            }
        } else {
            alert(data.error || 'Błąd logowania');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Weryfikacja TOTP
async function handleTotpVerify(e) {
    e.preventDefault();
    const totpCode = document.getElementById('totpCode').value;

    try {
        const res = await fetch(`${API_URL}/verify-totp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken, totpCode })
        });

        const data = await res.json();

        if (res.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            document.getElementById('totpCode').value = '';
            loadUserData();
        } else {
            alert(data.error || 'Nieprawidłowy kod');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Wylogowanie
function handleLogout() {
    token = null;
    tempToken = null;
    localStorage.removeItem('token');
    showPanel('authPanel');
}

// Załaduj dane użytkownika
async function loadUserData() {
    try {
        const res = await fetch(`${API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const user = await res.json();

        if (res.ok) {
            document.getElementById('userEmail').textContent = user.email;
            showPanel('mainPanel');
            
            if (!user.totp_enabled) {
                document.getElementById('totpSetup').classList.remove('hidden');
            }
            
            loadItems();
        } else {
            handleLogout();
        }
    } catch (error) {
        alert('Błąd ładowania danych');
        handleLogout();
    }
}

// Setup TOTP
async function setupTotp() {
    try {
        const res = await fetch(`${API_URL}/setup-totp`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('qrCodeContainer').innerHTML = 
                `<img src="${data.qrCode}" alt="QR Code">`;
            document.getElementById('qrModal').classList.remove('hidden');
        } else {
            alert(data.error || 'Błąd konfiguracji TOTP');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Włącz TOTP
async function enableTotp() {
    const totpCode = document.getElementById('enableTotpCode').value;

    if (!totpCode || totpCode.length !== 6) {
        alert('Wprowadź 6-cyfrowy kod');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/enable-totp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ totpCode })
        });

        const data = await res.json();

        if (res.ok) {
            alert('2FA włączone pomyślnie!');
            document.getElementById('totpSetup').classList.add('hidden');
            closeModal('qrModal');
        } else {
            alert(data.error || 'Nieprawidłowy kod');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Załaduj notatki
async function loadItems() {
    try {
        const res = await fetch(`${API_URL}/my-items`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const items = await res.json();

        if (res.ok) {
            displayItems(items);
        }
    } catch (error) {
        console.error('Błąd ładowania notatek');
    }
}

// Wyświetl notatki
function displayItems(items) {
    const container = document.getElementById('itemsList');
    
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">Brak notatek</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="item-card">
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.content || '')}</p>
            <div class="item-actions">
                <button class="edit-btn" onclick="openItemModal(${item.id}, '${escapeHtml(item.title)}', '${escapeHtml(item.content || '')}')">Edytuj</button>
                <button class="delete-btn" onclick="deleteItem(${item.id})">Usuń</button>
            </div>
        </div>
    `).join('');
}

// Otwórz modal notatki
function openItemModal(id = null, title = '', content = '') {
    currentEditId = id;
    document.getElementById('modalTitle').textContent = id ? 'Edytuj notatkę' : 'Nowa notatka';
    document.getElementById('itemTitle').value = title;
    document.getElementById('itemContent').value = content;
    document.getElementById('itemModal').classList.remove('hidden');
}

// Zapisz notatkę
async function saveItem() {
    const title = document.getElementById('itemTitle').value;
    const content = document.getElementById('itemContent').value;

    if (!title) {
        alert('Tytuł jest wymagany');
        return;
    }

    const method = currentEditId ? 'PUT' : 'POST';
    const url = currentEditId ? `${API_URL}/my-items/${currentEditId}` : `${API_URL}/my-items`;

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });

        if (res.ok) {
            closeModal('itemModal');
            loadItems();
        } else {
            const data = await res.json();
            alert(data.error || 'Błąd zapisu');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Usuń notatkę
async function deleteItem(id) {
    if (!confirm('Czy na pewno usunąć tę notatkę?')) return;

    try {
        const res = await fetch(`${API_URL}/my-items/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            loadItems();
        } else {
            alert('Błąd usuwania');
        }
    } catch (error) {
        alert('Błąd połączenia z serwerem');
    }
}

// Pomocnicze funkcje
function showPanel(panelId) {
    authPanel.classList.add('hidden');
    totpPanel.classList.add('hidden');
    mainPanel.classList.add('hidden');
    document.getElementById(panelId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('App.js loaded');
