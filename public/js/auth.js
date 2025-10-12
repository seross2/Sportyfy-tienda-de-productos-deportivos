// c:\Users\sergi\OneDrive\Documentos\Sportify-tienda-NUEVO\Sportify-V1\Sportyfy-tienda-de-productos-deportivos\templates\auth.js
import { getSupabaseClient } from '/js/supabaseClient.js'; // Esta ya estaba bien
import { syncCartOnLogin } from '/js/cart-logic.js'; // Esta ya estaba bien
import { showToast } from '/js/utils.js'; // Esta ya estaba bien

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
            // Sincronizar el carrito ANTES de redirigir
            await syncCartOnLogin();
            // Forzar siempre la redirección a la página principal (index)
            window.location.href = '/';
        }
    });
}

function handleRegisterForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creando cuenta...';

        const formData = new FormData(form);
        const email = formData.get('email');
        const userData = {
            // Estos nombres de campo coinciden con las columnas de tu tabla 'profiles'
            full_name: formData.get('name'),
            username: formData.get('username'),
        };

        if (!supabase) return showToast('Error de configuración de Supabase.');

     
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: formData.get('password'),
            options: {
                data: userData // Aquí se envían 'full_name' y 'username'
            }
        });

        if (error) {
                // Mejora para dar un mensaje más útil
                if (error.message.includes('duplicate key value violates unique constraint "profiles_username_key"')) {
                    showToast('Este nombre de usuario ya está en uso. Por favor, elige otro.', 'error');
                } else {
                    showToast(error.message, 'error');
                }
        } else {
            showToast('¡Registro exitoso! Revisa tu correo para confirmar.', 'success');
            form.reset();
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Crear Cuenta';
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
            form.reset();
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Enlace';
    });
}

function handleResetPasswordForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        const password = new FormData(form).get('password');
        if (!supabase) return showToast('Error de configuración de Supabase.');

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            showToast(`Error al actualizar la contraseña: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Guardar Nueva Contraseña';
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
            loginLink.innerHTML =
                '<a href="/profile.html">Mi Perfil</a>' +
                '<a href="#" id="logout-button" style="margin-left: 1rem;">Cerrar Sesión</a>';

            document.getElementById('logout-button').addEventListener('click', (e) => {
                if (!supabase) return;
                e.preventDefault();
                supabase.auth.signOut();
            });
        }

        // Verificar si es admin y si estamos en la página principal para cargar el panel
        if (mainContent) {
            if (!supabase) return;
            // Al cargar la página con sesión, sincronizamos el carrito de la DB a localStorage
            await syncCartOnLogin();

            const { data: profile } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single();
            // Si es admin, añade un enlace al panel en la navegación
            if (profile && profile.rol === 'admin' && !document.getElementById('admin-link')) {
                const navList = document.querySelector('header nav ul');
                if (navList) {
                    const adminLi = document.createElement('li');
                    adminLi.innerHTML = `<a href="/admin.html" id="admin-link">Panel Admin</a>`;
                    navList.appendChild(adminLi);
                }
            }
        }
    } else {
        // Usuario no logueado
        if (loginLink) loginLink.innerHTML = '<a href="/login.html">Login</a>';
    }
}

function handleLogoutRedirect(event) {
    // Redirigir al cerrar sesión para asegurar que la UI se limpie.
    if (event === 'SIGNED_OUT') window.location.href = '/';
}

async function main() {
    try {
        // 0. Inicializar Supabase obteniendo las claves del backend
        supabase = await getSupabaseClient();

        // Si la inicialización falla, no continuamos con la lógica de auth.
        if (!supabase) {
            throw new Error("No se pudo inicializar el cliente de Supabase.");
        }

        // 1. Configurar los formularios de la página actual
        const formHandlers = {
            'login-form': handleLoginForm,
            'register-form': handleRegisterForm,
            'forgot-password-form': handleForgotPasswordForm,
            'reset-password-form': handleResetPasswordForm,
        };

        // 2. Escuchar cambios de autenticación para actualizar la UI
        supabase.auth.onAuthStateChange((event, session) => {
            handleLogoutRedirect(event);
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
    } catch (error) {
        console.error("Error crítico en la inicialización de la autenticación:", error);
        showToast("Error de conexión con el servidor. Algunas funciones pueden no estar disponibles.", "error");
    }
}

// Ejecutar la lógica principal cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', main);