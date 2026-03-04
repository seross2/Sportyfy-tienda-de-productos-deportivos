import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';
import { shoppingCart } from '/js/cart-logic.js'; // Para usar formatPrice

let supabase;

/**
 * Carga y muestra todos los pedidos en el panel de administración.
 */
async function loadOrders() {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando pedidos...</p>';

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch('/api/admin/orders', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) throw new Error('No se pudieron cargar los pedidos.');

        const orders = await response.json();

        if (!orders || orders.length === 0) {
            container.innerHTML = '<p>No hay pedidos registrados.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'admin-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Envío</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(order => {
                    const cliente = order.profiles ? (order.profiles.username || order.profiles.full_name || order.profiles.email) : 'Desconocido';
                    const fecha = new Date(order.fecha_pedido).toLocaleDateString() + ' ' + new Date(order.fecha_pedido).toLocaleTimeString();
                    const envio = order.envios && order.envios.length > 0 ? order.envios[0].direccion : 'N/A';
                    
                    // Clase para colorear el estado
                    let statusClass = '';
                    if(order.estado === 'Pagado') statusClass = 'color: #28a745; font-weight: bold;';
                    else if(order.estado === 'Pendiente') statusClass = 'color: #ffc107; font-weight: bold;';
                    else statusClass = 'color: #dc3545; font-weight: bold;';

                    return `
                    <tr>
                        <td>#${order.id_pedido}</td>
                        <td>${fecha}</td>
                        <td>${cliente}</td>
                        <td>${shoppingCart.formatPrice(order.total)}</td>
                        <td style="${statusClass}">${order.estado}</td>
                        <td>${envio}</td>
                    </tr>
                `}).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p>Error al cargar pedidos: ${error.message}</p>`;
    }
}

/**
 * Inicializa la gestión de pedidos.
 */
export async function init() {
    supabase = await getSupabaseClient();
    const container = document.getElementById('orders-list-container');
    
    // Solo cargar si estamos en la sección correcta y el contenedor existe
    if (container) {
        loadOrders();
        
        // Escuchar evento personalizado por si se actualiza algo externamente
        document.addEventListener('ordersUpdated', loadOrders);
    }
}