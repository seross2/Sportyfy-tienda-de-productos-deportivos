import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

async function loadSizes() {
    const container = document.getElementById('sizes-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando tallas...</p>';
    try {
        const response = await fetch('/api/tallas');
        const sizes = await response.json();

        if (sizes.length === 0) {
            container.innerHTML = '<p>No hay tallas registradas.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'products-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${sizes.map(size => `
                    <tr data-id="${size.id_talla}">
                        <td>${size.id_talla}</td>
                        <td>${size.tipo}</td>
                        <td>${size.valor}</td>
                        <td>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${size.id_talla}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

        // Añadir listeners para los botones de eliminar
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDelete);
        });

    } catch (error) {
        container.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

async function handleDelete(event) {
    const id = event.target.dataset.id;
    if (!confirm(`¿Estás seguro de que quieres eliminar la talla con ID ${id}?`)) {
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`/api/tallas/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.details?.includes('violates foreign key constraint')) {
                throw new Error('No se puede eliminar. La talla está en uso por uno o más productos.');
            }
            throw new Error(errorData.error || 'No se pudo eliminar la talla.');
        }

        showToast('Talla eliminada con éxito.', 'success');
        document.querySelector(`tr[data-id="${id}"]`).remove();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function initPage() {
    supabase = await getSupabaseClient();
    loadSizes();
}

document.addEventListener('DOMContentLoaded', initPage);