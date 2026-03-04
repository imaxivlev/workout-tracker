// --- Auth UI Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // Clear any previous mock auth state for testing
    // localStorage.removeItem('mock_auth');
});

function switchAuthTab(tab) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });

    // Deactivate all tabs
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });

    // Reset all errors when switching
    resetAllErrors();

    // Show selected form
    if (tab === 'login') {
        document.getElementById('login-form').classList.add('active');
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
    } else if (tab === 'register') {
        document.getElementById('register-form').classList.add('active');
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
    } else if (tab === 'reset') {
        document.getElementById('reset-form').classList.add('active');
        // No active tab header for reset
    }
}

// --- Validation Helpers ---

function showError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(inputId + '-error');
    if (input) input.classList.add('error');
    if (errorDiv) errorDiv.textContent = message;
}

function clearError(inputId) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(inputId + '-error');
    if (input) input.classList.remove('error');
    if (errorDiv) errorDiv.textContent = '';
}

function resetAllErrors() {
    document.querySelectorAll('.form-input').forEach(input => input.classList.remove('error'));
    document.querySelectorAll('.form-error-msg').forEach(msg => msg.textContent = '');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- Handlers ---

function handleLogin(event) {
    event.preventDefault();
    resetAllErrors();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    let hasError = false;

    if (!email) {
        showError('login-email', 'Введите email');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showError('login-email', 'Некорректный email формат');
        hasError = true;
    }

    if (!password) {
        showError('login-password', 'Введите пароль');
        hasError = true;
    }

    if (!hasError) {
        // Mock successful login
        showNotification('Успешный вход!', 'success');
        localStorage.setItem('mock_auth', 'true');

        // Redirect to main app after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    }
}

function handleRegister(event) {
    event.preventDefault();
    resetAllErrors();

    const firstname = document.getElementById('reg-firstname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    let hasError = false;

    if (!firstname) {
        showError('reg-firstname', 'Имя обязательно');
        hasError = true;
    }

    if (!email) {
        showError('reg-email', 'Email обязателен');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showError('reg-email', 'Некорректный email формат');
        hasError = true;
    }

    if (!password) {
        showError('reg-password', 'Пароль обязателен');
        hasError = true;
    } else if (password.length < 8) {
        showError('reg-password', 'Минимум 8 символов');
        hasError = true;
    }

    if (!passwordConfirm) {
        showError('reg-password-confirm', 'Повторите пароль');
        hasError = true;
    } else if (password !== passwordConfirm) {
        showError('reg-password-confirm', 'Пароли не совпадают');
        hasError = true;
    }

    if (!hasError) {
        // Mock successful registration
        showNotification('Регистрация успешна! Входим...', 'success');
        localStorage.setItem('mock_auth', 'true');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    }
}

function handleReset(event) {
    event.preventDefault();
    resetAllErrors();

    const email = document.getElementById('reset-email').value.trim();

    if (!email) {
        showError('reset-email', 'Введите email');
        return;
    } else if (!isValidEmail(email)) {
        showError('reset-email', 'Некорректный email формат');
        return;
    }

    // Mock successful reset
    showNotification('Ссылка отправлена на ваш email', 'success');

    // Switch back to login after a delay
    setTimeout(() => {
        switchAuthTab('login');
        document.getElementById('login-email').value = email;
    }, 1500);
}

// --- Notifications ---
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `notification ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
