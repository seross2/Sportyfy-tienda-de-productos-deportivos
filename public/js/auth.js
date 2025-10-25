import { getSupabaseClient } from './supabaseClient.js';
import { syncCartOnLogin } from './cart-logic.js';
import { showToast } from './utils.js';

// --- INICIALIZACIÓN SEGURA DE SUPABASE ---
let supabase;

// ---------------------------------------------
// --- 1. MANEJADOR DE INICIO DE SESIÓN (LOGIN) ---
// --------------------------------------------- 
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
            showToast('Error al iniciar sesión. Revisa tu correo y contraseña.', 'error');
            console.error('Error en signInWithPassword:', error.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Iniciar Sesión';
        } else {
            showToast('¡Inicio de sesión exitoso!', 'success'); 
            // CORRECCIÓN: Consultar el rol desde la tabla 'profiles'
            const { data: { user } } = await supabase.auth.getUser(); 
            let userRole = 'user'; // Rol por defecto

            if (user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('id', user.id)
                    .single();
                if (profile) userRole = profile.rol;
            }

            setTimeout(async () => {
                await syncCartOnLogin();
                if (userRole === 'admin') {
                    // Si es admin, redirigir al panel de administración
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/'; // Redirigir a la página principal para usuarios normales
                }
            }, 1500);
        }
    });
}

// ---------------------------------------------
// --- 2. MANEJADOR DE REGISTRO (SIGN UP) ---
// ---------------------------------------------
function handleRegisterForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creando cuenta...';

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        
        const userData = {
            full_name: formData.get('name'),
            username: formData.get('username'),
            phone: formData.get('phone') || null, 
        };

        if (password.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Crear Cuenta';
            return;
        }
        if (!supabase) return showToast('Error de configuración de Supabase.');

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (authError) {
            if (authError.message.includes('User already registered')) {
                 showToast('Ya existe una cuenta con este correo. Intenta iniciar sesión.', 'error');
            } else if (authError.message.toLowerCase().includes('password should be stronger')) {
                showToast('La contraseña es muy débil. Intenta combinar letras, números y símbolos.', 'error');
            } else {
                 showToast('Usuario o contraseña incorrectos.', 'error');
            }
        } else if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    full_name: userData.full_name,
                    username: userData.username,
                    correo: email, 
                    phone: userData.phone 
                })
                .eq('id', authData.user.id);

            if (profileError) {
                console.error(
                    "ADVERTENCIA: El usuario se creó, pero no se pudo actualizar el perfil. Causa probable: trigger 'handle_new_user' falló o RLS lo impidió.", 
                    profileError
                );
                if (profileError.message.includes('duplicate key value violates unique constraint "profiles_username_key"')) {
                    showToast('Ese nombre de usuario ya está en uso. Elige otro.', 'error');
                } else {
                    showToast('Registro casi completo. Por favor, contacta a soporte.', 'warning');
                }
            } else {
                showToast('¡Cuenta creada! Revisa tu correo para verificarla.', 'success');
                form.reset();
            }
        } else {
             showToast('Registro iniciado. Revisa tu correo para confirmar.', 'success');
             form.reset();
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Crear Cuenta';
    });
}

// ---------------------------------------------
// --- 3. MANEJADOR DE RECUPERACIÓN DE CONTRASEÑA ---
// ---------------------------------------------
function handleForgotPasswordForm(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const email = new FormData(form).get('email');
        if (!supabase) return showToast('Error de configuración de Supabase.');
        
        const redirectUrl = `${window.location.origin}/reset-password.html`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });

        if (error) {
            showToast('Ocurrió un error. Verifica tu correo o intenta de nuevo.', 'error');
        } else {
            showToast('Se ha enviado un enlace de recuperación a tu correo.', 'success');
            form.reset();
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Enlace';
    });
}

// ---------------------------------------------
// --- 4. MANEJADOR DE RESTABLECIMIENTO DE CONTRASEÑA ---
// ---------------------------------------------------
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

// ---------------------------------------------
// --- 5. MANEJO DE LA INTERFAZ DE USUARIO (UI) ---
// ---------------------------------------------

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

    if (session) {
        // Usuario logueado
        if (navLogin) navLogin.style.display = 'none';
        if (navRegister) navRegister.style.display = 'none';

        if (navUser && navUserLink) {
            const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
            navUserLink.textContent = profile?.username || session.user.email;
            navUser.style.display = 'block';
        }

        // CORRECCIÓN: Consultar el rol desde la tabla 'profiles' para mostrar el panel de admin
        let userRole = 'user'; // Rol por defecto
        if (session.user) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('rol')
                .eq('id', session.user.id)
                .single();
            if (profile) userRole = profile.rol;
        }
        if (navAdmin && userRole === 'admin') {
            navAdmin.style.display = 'block';
        }

        if (navLogout) navLogout.style.display = 'block';

    } else {
        // Usuario no logueado
        if (navLogin) navLogin.style.display = 'block';
        if (navRegister) navRegister.style.display = 'block';
        if (navUser) navUser.style.display = 'none';
        if (navLogout) navLogout.style.display = 'none';
        if (navAdmin) navAdmin.style.display = 'none';
    }
}

// ---------------------------------------------
// --- 6. FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ---
// ---------------------------------------------
async function main() {
    try {
        supabase = await getSupabaseClient();

        if (!supabase) {
            console.error("Error crítico: No se pudo inicializar el cliente de Supabase.");
            showToast("Error de conexión con el servidor. Refresca la página para intentarlo de nuevo.", "error");
            return;
        }

        const formHandlers = {
            'login-form': handleLoginForm,
            'register-form': handleRegisterForm,
            'forgot-password-form': handleForgotPasswordForm,
            'reset-password-form': handleResetPasswordForm,
        };

        // CORRECCIÓN: Llamar a updateUI() inmediatamente al cargar la página
        // para reflejar el estado de sesión actual sin esperar un evento.
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        updateUI(initialSession);

        // Manejar el botón de logout de forma global
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', async (e) => {
                e.preventDefault(); // Evita que el enlace recargue la página
                await supabase.auth.signOut();
                window.location.href = '/'; // Redirigir al inicio después de cerrar sesión
            });
        }

        // Escuchar futuros cambios de autenticación
        supabase.auth.onAuthStateChange((event, session) => {
            console.log(`Auth event: ${event}`, session);
            updateUI(session);
        });

        // CORRECCIÓN CRÍTICA: Ligar correctamente los manejadores a los formularios usando su ID.
        for (const formId in formHandlers) {
            const form = document.getElementById(formId);
            if (form) {
                formHandlers[formId](form); // Sintaxis corregida para llamar a la función.
            }
        }
    } catch (error) {
        console.error("Error crítico en la inicialización de la autenticación:", error);
        showToast("Error de conexión. Por favor, refresca la página.", "error");
    }
}

document.addEventListener('DOMContentLoaded', main);
