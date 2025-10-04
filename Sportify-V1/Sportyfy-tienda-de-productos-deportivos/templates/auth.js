import { getSupabaseClient } from '/supabaseClient.js';
import { showToast } from '/utils.js';

// --- INICIALIZACIÓN SEGURA DE SUPABASE ---
let supabase;

function handleLoginForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Iniciando...';

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');

        if (!supabase) return showToast('Error de configuración de Supabase.');

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showToast(error.message, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Iniciar Sesión';
        } else {
            window.location.href = '/'; // Redirigir a la página principal
        }
    });
}

function handleRegisterForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const userData = {
            full_name: formData.get('name'),
            username: formData.get('username'),
            identification: formData.get('identification'),
        };

        if (!supabase) return showToast('Error de configuración de Supabase.');

        const { error } = await supabase.auth.signUp({
            email: formData.get('email'),
            password: formData.get('password'),
            options: { data: userData }
        });

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('¡Registro exitoso! Revisa tu correo para confirmar.', 'success');
            form.reset();
        }
    });
}

function handleForgotPasswordForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const email = new FormData(form).get('email');
        if (!supabase) return showToast('Error de configuración de Supabase.');

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password.html`,
        });

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Se ha enviado un enlace de recuperación a tu correo.', 'success');
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Enlace de Recuperación';
    });
}

function handleResetPasswordForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = new FormData(form).get('password');
        if (!supabase) return showToast('Error de configuración de Supabase.');

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            showToast(`Error al actualizar la contraseña: ${error.message}`, 'error');
        } else {
            showToast('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.', 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 3000);
        }
    });
}

async function updateUserUI(session) {
    const loginLink = document.getElementById('login-link');
    const mainContent = document.getElementById('main-content');

    if (session) {
        // Usuario logueado
        if (loginLink) {
            loginLink.innerHTML = '<a href="#" id="logout-button">Cerrar Sesión</a>';
            document.getElementById('logout-button').addEventListener('click', (e) => {
                if (!supabase) return;
                e.preventDefault();
                supabase.auth.signOut();
            });
        }

        // Verificar si es admin y si estamos en la página principal
        if (mainContent) {
            if (!supabase) return;
            const { data: profile } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single();
            if (profile && profile.rol === 'admin') {
                // Cargar el panel de admin
                try {
                    const response = await fetch('/admin.html');
                    const html = await response.text();
                    
                    // Usar DOMParser es más seguro y robusto que innerHTML
                    const parser = new DOMParser();
                    const adminDoc = parser.parseFromString(html, 'text/html');
                    const adminContent = adminDoc.querySelector('main');

                    if (adminContent) {
                        mainContent.innerHTML = ''; // Limpiar el contenido actual
                        mainContent.appendChild(adminContent);

                        // Cargar el script asociado al panel de admin
                        loadAdminScript();
                    }
                } catch (err) {
                    console.error("Error al cargar el panel de admin:", err);
                }
            }
        }
    } else {
        // Usuario no logueado
        if (loginLink) loginLink.innerHTML = '<a href="/login.html">Login</a>';
    }
}

function loadAdminScript() {
    // Carga el script solo si no ha sido cargado antes
    if (!document.querySelector('script[src="/admin.js"]')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/admin.js';
        document.body.appendChild(script);
    }
}

async function main() {
    // 0. Inicializar Supabase obteniendo las claves del backend
    supabase = await getSupabaseClient();

    // Si la inicialización falla, no continuamos con la lógica de auth.
    if (!supabase) return;

    // 1. Configurar los formularios de la página actual
    const formHandlers = {
        'login-form': handleLoginForm,
        'register-form': handleRegisterForm,
        'forgot-password-form': handleForgotPasswordForm,
        'reset-password-form': handleResetPasswordForm,
    };

    // 2. Escuchar cambios de autenticación para actualizar la UI
    supabase.auth.onAuthStateChange((event, session) => {
        // Si se cierra sesión, redirigir a la página principal
        if (event === 'PASSWORD_RECOVERY') {
            // Este evento se dispara en la página de reseteo de contraseña.
            // No necesitamos hacer nada aquí, el formulario se encargará.
            return;
        }
        if (event === 'SIGNED_OUT' && window.location.pathname !== '/') {
            window.location.href = '/';
        }
        updateUserUI(session);
    });

    // 3. Verificar la sesión inicial al cargar la página
    const { data: { session } } = await supabase.auth.getSession();
    updateUserUI(session);

    // 4. Ligar los manejadores a los formularios que existan en la página
    for (const formId in formHandlers) {
        const form = document.getElementById(formId);
        if (form) formHandlers[formId](form);
    }
}

// Ejecutar la lógica principal cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', main);