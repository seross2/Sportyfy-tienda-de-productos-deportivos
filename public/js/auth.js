import { getSupabaseClient } from './supabaseClient.js';
import { syncCartOnLogin } from './cart-logic.js';
import { showToast } from './utils.js';

let supabase;

/**
 * Maneja el envío del formulario de inicio de sesión.
 * @param {HTMLFormElement} form - El formulario de login.
 */
function handleLoginForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Iniciando...';

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');

        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showToast('Error al iniciar sesión. Revisa tu correo y contraseña.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Iniciar Sesión';
            return;
        }

        if (authData.user && !authData.user.email_confirmed_at) {
            showToast('Tu cuenta no ha sido verificada. Revisa tu correo.', 'error');
            await supabase.auth.signOut();
            submitButton.disabled = false;
            submitButton.textContent = 'Iniciar Sesión';
            return;
        }

        showToast('¡Inicio de sesión exitoso!', 'success');
        
        const { data: profile } = await supabase.from('profiles').select('rol').eq('id', authData.user.id).single();
        
        setTimeout(async () => {
            await syncCartOnLogin();
            const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else if (profile?.rol === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/';
            }
        }, 1500);
    });
}

/**
 * Maneja el envío del formulario de registro.
 * @param {HTMLFormElement} form - El formulario de registro.
 */
function handleRegisterForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creando cuenta...';

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        
        if (password.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Crear Cuenta';
            return;
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: formData.get('name'),
                    username: formData.get('username'),
                    phone: formData.get('phone') || null,
                }
            }
        });

        if (error) {
            showToast(error.message.includes('User already registered')
                ? 'Ya existe una cuenta con este correo. Intenta iniciar sesión.'
                : `Error en el registro: ${error.message}`, 'error');
        } else {
            showToast('¡Registro exitoso!', 'success');
            setTimeout(() => window.location.href = '/check-email.html', 1000);
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Crear Cuenta';
    });
}

/**
 * Actualiza la barra de navegación para reflejar el estado de autenticación.
 * @param {import('@supabase/supabase-js').Session | null} session
 */
async function updateUI(session) {
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navUser = document.getElementById('nav-user');
    const navUserLink = document.getElementById('nav-user-link');
    const navLogout = document.getElementById('nav-logout');
    const navAdmin = document.getElementById('nav-admin');
    const storeLinks = document.querySelectorAll('.store-link'); // Seleccionamos los enlaces de la tienda
    const isAdminPage = window.location.pathname.startsWith('/admin');

    if (session) {
        // Usuario logueado
        navLogin.style.display = 'none';
        navRegister.style.display = 'none';

        const { data: profile } = await supabase.from('profiles').select('username, rol').eq('id', session.user.id).single();
        
        navUserLink.textContent = profile?.username || session.user.email;
        navUser.style.display = 'block';
        navLogout.style.display = 'block';

        if (profile?.rol === 'admin' && !isAdminPage) {
            navAdmin.style.display = 'block';
        } else {
            navAdmin.style.display = 'none';
        }

        // Si es admin y está en la página de admin, ocultar los enlaces de la tienda
        if (profile?.rol === 'admin' && isAdminPage) {
            storeLinks.forEach(link => link.style.display = 'none');
        } else {
            storeLinks.forEach(link => link.style.display = 'list-item'); // O 'block' si prefieres
        }

    } else {
        // Usuario no logueado
        navLogin.style.display = 'block';
        navRegister.style.display = 'block';
        navUser.style.display = 'none';
        navLogout.style.display = 'none';
        navAdmin.style.display = 'none';
        storeLinks.forEach(link => link.style.display = 'list-item');
    }
}

/**
 * Función principal de inicialización.
 */
async function main() {
    supabase = await getSupabaseClient();
    if (!supabase) {
        console.error("Error crítico: No se pudo inicializar el cliente de Supabase.");
        return;
    }

    // Manejar formularios de autenticación si existen en la página actual
    const loginForm = document.getElementById('login-form');
    if (loginForm) handleLoginForm(loginForm);

    const registerForm = document.getElementById('register-form');
    if (registerForm) handleRegisterForm(registerForm);

    // Manejar el botón de logout de forma global
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '/';
        });
    }

    // Escuchar cambios de autenticación para actualizar la UI
    supabase.auth.onAuthStateChange((_event, session) => {
        updateUI(session);
    });

    // Actualizar la UI con la sesión inicial
    const { data: { session } } = await supabase.auth.getSession();
    updateUI(session);
}

document.addEventListener('DOMContentLoaded', main);
