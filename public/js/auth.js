import { getSupabaseClient } from './supabaseClient.js';
import { shoppingCart } from './cart-logic.js';
import { showToast } from './utils.js';
import '/js/global.js'; // Asegura que el menú global se cargue y gestione

let supabase;

/**
 * Maneja el envío del formulario de inicio de sesión.
 * @param {HTMLFormElement} form - El formulario de login.
 */
function handleLoginForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!supabase) {
            showToast('Conectando con el servidor, intenta de nuevo en un momento...', 'error');
            return;
        }

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
            await shoppingCart.syncOnLogin();
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

        if (!supabase) {
            showToast('Conectando con el servidor, intenta de nuevo en un momento...', 'error');
            return;
        }

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
                emailRedirectTo: `${window.location.origin}/login.html`,
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
            // Guardamos el email para poder usar la función de "Reenviar correo" en la siguiente página
            localStorage.setItem('lastRegisteredEmail', email);
            showToast('¡Registro exitoso!', 'success');
            setTimeout(() => window.location.href = '/check-email.html', 1000);
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Crear Cuenta';
    });
}

/**
 * Maneja el botón de reenviar correo de confirmación.
 */
function handleResendEmail() {
    const resendBtn = document.getElementById('resend-email-btn');
    if (!resendBtn) return;

    resendBtn.addEventListener('click', async () => {
        const email = localStorage.getItem('lastRegisteredEmail');
        
        if (!email) {
            showToast('No se encontró el correo. Por favor regístrate de nuevo.', 'error');
            return;
        }

        resendBtn.disabled = true;
        resendBtn.textContent = 'Enviando...';

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: `${window.location.origin}/login.html`
            }
        });

        if (error) {
            showToast(`Error: ${error.message}`, 'error');
            // Si es error 429 (Too Many Requests), es que pidió muchos muy rápido
        } else {
            showToast('Correo reenviado. Revisa tu bandeja.', 'success');
        }

        // Habilitar de nuevo después de unos segundos para evitar spam
        setTimeout(() => {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Reenviar Correo';
        }, 5000);
    });
}

/**
 * Maneja el formulario de olvido de contraseña.
 */
function handleForgotPasswordForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!supabase) {
            showToast('Conectando con el servidor, intenta de nuevo...', 'error');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const email = new FormData(form).get('email');

        // CAMBIO: Usamos signInWithOtp para generar un código (OTP) en lugar de un enlace de recuperación
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: { shouldCreateUser: false }
        });

        if (error) {
            showToast(`Error: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar Enlace';
        } else {
            showToast('Código de recuperación enviado a tu correo.', 'success');
            form.classList.add('hidden');
            const verifyForm = document.getElementById('verify-pin-form');
            if (verifyForm) {
                verifyForm.classList.remove('hidden');
                verifyForm.querySelector('#recovery-email').value = email;
            }
        }
    });
}

/**
 * Maneja el formulario para actualizar la contraseña.
 */
function handleVerifyPinForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Verificando...';

        const formData = new FormData(form);
        const email = formData.get('email');
        const pin = formData.get('pin');
        const password = new FormData(form).get('password');
        const confirmPassword = new FormData(form).get('confirm-password');

        if (password.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Verificar y Cambiar Contraseña';
            return;
        }

        if (password !== confirmPassword) {
            showToast('Las contraseñas no coinciden.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Verificar y Cambiar Contraseña';
            return;
        }

        // 1. Verify the OTP (PIN/Code)
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            email: email,
            token: pin,
            type: 'email' // CAMBIO: El tipo debe ser 'email' para códigos OTP generados por signInWithOtp
        });

        if (verifyError || !verifyData.session) {
            showToast(verifyError?.message || 'Código de verificación inválido.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Verificar y Cambiar Contraseña';
            return;
        }

        // 2. If OTP is correct, update the password
        submitButton.textContent = 'Actualizando...';
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
            showToast(`Error al actualizar la contraseña: ${updateError.message}`, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Verificar y Cambiar Contraseña';
        } else {
            showToast('Contraseña actualizada con éxito. Redirigiendo a Iniciar Sesión...', 'success');
            await supabase.auth.signOut(); // Forzar cierre de sesión para que el usuario inicie sesión manualmente
            setTimeout(() => window.location.href = '/login.html', 2000);
        }
    });
}

/**
 * Función principal de inicialización.
 */
async function main() {
    // 1. Adjuntar listeners INMEDIATAMENTE para prevenir el envío nativo del formulario
    const loginForm = document.getElementById('login-form');
    if (loginForm) handleLoginForm(loginForm);

    const registerForm = document.getElementById('register-form');
    if (registerForm) handleRegisterForm(registerForm);

    // Manejar reenvío de correo
    handleResendEmail();

    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) handleForgotPasswordForm(forgotPasswordForm);

    const verifyPinForm = document.getElementById('verify-pin-form');
    if (verifyPinForm) handleVerifyPinForm(verifyPinForm);

    // 2. Inicializar Supabase
    supabase = await getSupabaseClient();
    if (!supabase) {
        console.error("Error crítico: No se pudo inicializar el cliente de Supabase.");
        showToast('Error de conexión con el servidor.', 'error');
        return;
    }

    // 3. Verificar si el usuario ya tiene sesión (ej. viene del enlace del correo de confirmación)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Flujo de verificación de email: solo si estamos en login.html y hay un token en el hash.
        const isOnLoginPage = !!document.getElementById('login-form');
        const hasVerificationToken = window.location.hash && window.location.hash.includes('access_token');

        if (isOnLoginPage && hasVerificationToken) {
            showToast('¡Cuenta verificada! Redirigiendo a Iniciar Sesión...', 'success');
            history.replaceState(null, '', window.location.pathname); // Limpiar el hash para evitar re-activación
            await supabase.auth.signOut(); // Forzar cierre de sesión para que el usuario inicie sesión manualmente
            setTimeout(() => window.location.href = '/login.html', 1500);
        } else if (isOnLoginPage || document.getElementById('register-form')) {
            // Si el usuario ya tiene sesión y está en login/register (y no es por verificación), redirigir al inicio.
            window.location.href = '/';
        }
    }
}

document.addEventListener('DOMContentLoaded', main);
