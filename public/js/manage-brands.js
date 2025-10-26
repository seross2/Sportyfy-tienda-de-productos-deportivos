import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

async function loadBrands() {
    const container = document.getElementById('brands-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando marcas...</p>';
    try {
        const response = await fetch('/api/marcas');
        const brands = await response.json();

        if (brands.length === 0) {
            container.innerHTML = '<p>No hay marcas registradas.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'products-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${brands.map(brand => `
                    <tr data-id="${brand.id_marca}">
                        <td>${brand.id_marca}</td>
                        <td>${brand.nombre}</td>
                        <td>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${brand.id_marca}">Eliminar</button>
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
    if (!confirm(`¿Estás seguro de que quieres eliminar la marca con ID ${id}?`)) {
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`/api/marcas/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.details?.includes('violates foreign key constraint')) {
                throw new Error('No se puede eliminar. La marca está en uso por uno o más productos.');
            }
            throw new Error(errorData.error || 'No se pudo eliminar la marca.');
        }

        showToast('Marca eliminada con éxito.', 'success');
        document.querySelector(`tr[data-id="${id}"]`).remove();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function initPage() {
    supabase = await getSupabaseClient();
    loadBrands();
}

document.addEventListener('DOMContentLoaded', initPage);