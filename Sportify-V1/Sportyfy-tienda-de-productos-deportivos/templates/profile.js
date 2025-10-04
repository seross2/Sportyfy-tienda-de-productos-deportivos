import { getSupabaseClient } from '/supabaseClient.js';
import { showToast } from '/utils.js';

async function loadProfileData() {
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html'; // Redirigir si no está logueado
        return;
    }

    // Cargar detalles del perfil
    const profileDetailsContainer = document.getElementById('profile-details');
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile) {
        profileDetailsContainer.innerHTML = '<p>No se pudo cargar la información del perfil.</p>';
    } else {
        profileDetailsContainer.innerHTML = `
            <p><strong>Usuario:</strong> ${profile.username || 'No definido'}</p>
            <p><strong>Nombre:</strong> ${profile.full_name || 'No definido'}</p>
        `;
    }

    // Cargar historial de pedidos
    const orderHistoryContainer = document.getElementById('order-history');
    try {
        const response = await fetch('/api/user/orders', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) throw new Error('No se pudo cargar el historial de pedidos.');

        const orders = await response.json();

        if (orders.length === 0) {
            orderHistoryContainer.innerHTML = '<p>Aún no has realizado ningún pedido.</p>';
            return;
        }

        orderHistoryContainer.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID Pedido</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Dirección</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>${order.id_pedido}</td>
                            <td>${new Date(order.fecha_pedido).toLocaleDateString()}</td>
                            <td>${order.estado}</td>
                            <td>${order.direccion_envio}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        orderHistoryContainer.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadProfileData);