import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

async function loadProductsTable() {
    const container = document.getElementById('products-table-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando productos...</p>';

    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('No se pudieron cargar los productos.');
        
        const products = await response.json();

        if (products.length === 0) {
            container.innerHTML = '<p>No hay productos registrados.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'products-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(p => `
                    <tr data-id="${p.id_producto}">
                        <td>${p.id_producto}</td>
                        <td>${p.nombre}</td>
                        <td>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio)}</td>
                        <td>${p.stock}</td>
                        <td>
                            <a href="/edit-product.html?id=${p.id_producto}" class="btn btn-secondary btn-sm">Editar</a>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id_producto}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.innerHTML = '';
        container.appendChild(table);

        // Añadir listeners para los botones de eliminar
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteProduct);
        });

    } catch (error) {
        container.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

async function handleDeleteProduct(event) {
    const productId = event.target.dataset.id;
    if (!confirm(`¿Estás seguro de que quieres eliminar el producto con ID ${productId}?`)) {
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            showToast('Tu sesión ha expirado. Inicia sesión de nuevo.', 'error');
            return;
        }

        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo eliminar el producto.');
        }

        showToast('Producto eliminado con éxito.', 'success');
        // Eliminar la fila de la tabla visualmente
        document.querySelector(`tr[data-id="${productId}"]`).remove();

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function initDashboard() {
    supabase = await getSupabaseClient();
    // La protección de la ruta ya la hace auth.js y el middleware del servidor.
    // Aquí solo nos enfocamos en cargar el contenido.
    loadProductsTable();
}

document.addEventListener('DOMContentLoaded', initDashboard);