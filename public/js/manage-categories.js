import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

async function loadCategories() {
    const container = document.getElementById('categories-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando categorías...</p>';
    try {
        const response = await fetch('/api/categorias');
        const categories = await response.json();

        if (categories.length === 0) {
            container.innerHTML = '<p>No hay categorías registradas.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'products-table'; // Reutilizamos la clase de la tabla de productos
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${categories.map(cat => `
                    <tr data-id="${cat.id_categoria}">
                        <td>${cat.id_categoria}</td>
                        <td>${cat.nombre}</td>
                        <td>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${cat.id_categoria}">Eliminar</button>
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
    if (!confirm(`¿Estás seguro de que quieres eliminar la categoría con ID ${id}?`)) {
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`/api/categorias/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            // Manejo de error de clave foránea
            if (errorData.details?.includes('violates foreign key constraint')) {
                throw new Error('No se puede eliminar. La categoría está en uso por uno o más productos.');
            }
            throw new Error(errorData.error || 'No se pudo eliminar la categoría.');
        }

        showToast('Categoría eliminada con éxito.', 'success');
        document.querySelector(`tr[data-id="${id}"]`).remove();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function initPage() {
    supabase = await getSupabaseClient();
    loadCategories();
}

document.addEventListener('DOMContentLoaded', initPage);