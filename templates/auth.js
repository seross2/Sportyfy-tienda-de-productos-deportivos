import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- INICIALIZACIÓN SEGURA DE SUPABASE ---
let supabase;

async function initializeSupabase() {
    try {
        const response = await fetch('/api/config'); // Endpoint que crearemos en el backend
        if (!response.ok) {
            throw new Error('No se pudo obtener la configuración del servidor.');
        }
        const config = await response.json();
        
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('La configuración de Supabase está incompleta.');
        }

        return createClient(config.supabaseUrl, config.supabaseAnonKey);
    } catch (error) {
        console.error("Error inicializando Supabase:", error);
        showToast("Error de configuración. La autenticación no funcionará.", "error");
        return null;
    }
}

function showToast(message, type = 'error') {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    messageDiv.style.display = 'block';

    setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
}

function setupAuthForms() {
    // Formulario de Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Iniciando...';

            const formData = new FormData(loginForm);
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

    // Formulario de Registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const userData = {
                full_name: formData.get('name'),
                username: formData.get('username'),
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
                registerForm.reset();
            }
        });
    }
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
                fetch('/admin.html')
                    .then(res => res.text())
                    .then(html => {
                        mainContent.innerHTML = html; // 1. Inserta el HTML del panel

                        // 2. SOLO DESPUÉS de insertar el HTML, carga el script
                        // Esto garantiza que los 'select' existan cuando admin.js se ejecute.
                        if (!document.querySelector('script[src="/admin.js"]')) { // Evita cargarlo múltiples veces
                            const script = document.createElement('script');
                            script.type = 'module';
                            script.src = '/admin.js';
                            document.body.appendChild(script);
                        }
                    });
            }
        }
    } else {
        // Usuario no logueado
        if (loginLink) loginLink.innerHTML = '<a href="/login.html">Login</a>';
        
        // Si estamos en la página principal, asegurarse de que se vean los productos
        if (mainContent && !mainContent.querySelector('#products')) {
             window.location.reload(); // Recargar para mostrar los productos
        }
    }
}

async function main() {
    // 0. Inicializar Supabase obteniendo las claves del backend
    supabase = await initializeSupabase();

    // Si la inicialización falla, no continuamos con la lógica de auth.
    if (!supabase) return;

    // 1. Configurar los formularios de la página actual
    setupAuthForms();

    // 2. Escuchar cambios de autenticación para actualizar la UI
    supabase.auth.onAuthStateChange((event, session) => {
        // Si se cierra sesión, redirigir a la página principal
        if (event === 'SIGNED_OUT' && window.location.pathname !== '/') {
            window.location.href = '/';
        }
        updateUserUI(session);
    });

    // 3. Verificar la sesión inicial al cargar la página
    const { data: { session } } = await supabase.auth.getSession();
        updateUserUI(session);
    
}

// Ejecutar la lógica principal cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', main);