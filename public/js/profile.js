import { getSupabaseClient } from './supabaseClient.js';
import { showToast } from './utils.js';

let supabase;
let currentUserProfile = null;

/**
 * Renderiza la estructura principal de la página de perfil.
 * @param {object} profile - Los datos del perfil del usuario (username, full_name, etc.).
 */
function renderProfileLayout(profile) {
    const container = document.getElementById('profile-page-container');
    if (!container) return;

    container.innerHTML = `
        <div class="profile-container">
            <aside class="profile-sidebar">
                <ul>
                    <li><button class="profile-nav-btn active" data-target="profile-details">Mi Perfil</button></li>
                    <li><button class="profile-nav-btn" data-target="order-history">Mis Pedidos</button></li>
                    <li><button class="profile-nav-btn" data-target="account-settings">Configuración</button></li>
                </ul>
            </aside>
            <div class="profile-content">
                <!-- Sección de Detalles del Perfil -->
                <section id="profile-details" class="profile-section active">
                    <img src="${profile.avatar_url || 'https://via.placeholder.com/120?text=Avatar'}" alt="Avatar" class="profile-avatar">
                    <h3>Hola, ${profile.full_name || profile.username || 'Usuario'}</h3>
                    <p>Aquí puedes ver la información de tu cuenta.</p>
                    <br>
                    <div class="profile-details-grid">
                        <p><strong>Nombre de usuario:</strong> ${profile.username || 'No especificado'}</p>
                        <p><strong>Nombre completo:</strong> ${profile.full_name || 'No especificado'}</p>
                        <p><strong>Email:</strong> ${profile.email}</p>
                        <p><strong>Teléfono:</strong> ${profile.phone || 'No especificado'}</p>
                        <p><strong>Sitio Web:</strong> ${profile.website ? `<a href="${profile.website}" target="_blank" rel="noopener noreferrer">${profile.website}</a>` : 'No especificado'}</p>
                    </div>
                    <br>
                </section>
                <!-- Sección de Historial de Pedidos -->
                <section id="order-history" class="profile-section">
                    <h3>Mis Pedidos</h3>
                    <div id="order-history-list" class="order-history-list">
                        <p>Cargando historial de pedidos...</p>
                    </div>
                </section>
                <!-- Sección de Configuración (ahora con el formulario de edición) -->
                <section id="account-settings" class="profile-section">
                    <h3>Editar Mi Perfil</h3>
                    <form id="profile-edit-form">
                        <div>
                            <label for="username">Nombre de Usuario</label>
                            <input type="text" id="username" name="username" value="${profile.username || ''}" required>
                        </div>
                        <div>
                            <label for="full_name">Nombre Completo</label>
                            <input type="text" id="full_name" name="full_name" value="${profile.full_name || ''}">
                        </div>
                        <div>
                            <label for="phone">Teléfono</label>
                            <input type="tel" id="phone" name="phone" value="${profile.phone || ''}">
                        </div>
                        <div>
                            <label for="website">Sitio Web</label>
                            <input type="url" id="website" name="website" value="${profile.website || ''}" placeholder="https://ejemplo.com">
                        </div>
                        <div>
                            <label for="avatar_url">URL del Avatar</label>
                            <input type="url" id="avatar_url" name="avatar_url" value="${profile.avatar_url || ''}" placeholder="https://ejemplo.com/imagen.png">
                        </div>
                        <br>
                        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                    </form>
                </section>
            </div>
        </div>
    `;

    // Añadir listeners a los botones de navegación del perfil
    addNavButtonListeners();

    // Añadir el listener al formulario de edición
    document.getElementById('profile-edit-form').addEventListener('submit', handleProfileUpdate);
}

/**
 * Carga y muestra el historial de pedidos del usuario.
 */
async function loadOrderHistory() {
    const orderListContainer = document.getElementById('order-history-list');
    if (!orderListContainer) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No hay sesión activa.');

        const response = await fetch('/api/user/orders', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) throw new Error('No se pudo cargar el historial de pedidos.');

        const orders = await response.json();

        if (orders.length === 0) {
            orderListContainer.innerHTML = '<p>Aún no has realizado ningún pedido.</p>';
            return;
        }

        const currencyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

        orderListContainer.innerHTML = orders.map(order => `
            <div class="order-item">
                <div class="order-item-header">
                    <div>
                        <strong>Pedido #${order.id_pedido}</strong>
                        <p style="font-size: 0.9rem; color: var(--text-color-light);">Fecha: ${new Date(order.fecha_pedido).toLocaleDateString()}</p>
                    </div>
                    <span class="order-status ${order.estado}">${order.estado}</span>
                </div>
                <div class="order-item-body">
                    <p><strong>Total:</strong> ${currencyFormatter.format(order.total)}</p>
                    <p><strong>Dirección de envío:</strong> ${order.direccion_envio}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error al cargar el historial de pedidos:', error);
        orderListContainer.innerHTML = '<p>Hubo un error al cargar tus pedidos. Inténtalo de nuevo más tarde.</p>';
    }
}

/**
 * Añade los listeners para los botones de navegación del sidebar.
 */
function addNavButtonListeners() {
    const navButtons = document.querySelectorAll('.profile-nav-btn');
    const sections = document.querySelectorAll('.profile-section');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
           
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

/**
 * Maneja la actualización de los datos del perfil.
 * @param {Event} e - El evento de envío del formulario.
 */
async function handleProfileUpdate(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';

    const formData = new FormData(form);
    const updates = {
        username: formData.get('username'),
        full_name: formData.get('full_name'),
        phone: formData.get('phone'),
        website: formData.get('website'),
        avatar_url: formData.get('avatar_url'),
        updated_at: new Date(),
    };

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUserProfile.id);

    if (error) {
        showToast(`Error al actualizar: ${error.message}`, 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar Cambios';
    } else {
        showToast('Perfil actualizado con éxito.', 'success');
        // Recargar la página para ver todos los cambios reflejados
        setTimeout(() => window.location.reload(), 1500);
    }
}

/**
 * Función principal de inicialización de la página de perfil.
 */
async function initProfilePage() {
    supabase = await getSupabaseClient();
    if (!supabase) {
        showToast('Error de conexión con el servidor.', 'error');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = '/login.html?redirect=/profile.html';
        return;
    }

    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

    if (error || !profile) {
        showToast('No se pudo cargar la información del perfil.', 'error');
        const container = document.getElementById('profile-page-container');
        if (container) container.innerHTML = '<p>Error al cargar el perfil. Intenta recargar la página.</p>';
        return;
    }

    currentUserProfile = { ...profile, email: session.user.email };
    renderProfileLayout(currentUserProfile);
    loadOrderHistory();
}

document.addEventListener('DOMContentLoaded', initProfilePage);