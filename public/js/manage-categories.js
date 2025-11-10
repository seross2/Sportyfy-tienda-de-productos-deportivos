import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
const API_ENDPOINT = '/api/categorias';

async function loadCategories() {
    const container = document.getElementById('categories-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando categorías...</p>';
    try {
        const response = await fetch(API_ENDPOINT);
        const categories = await response.json();

        if (categories.length === 0) {
            container.innerHTML = '<p>No hay categorías registradas.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'admin-table'; // Usamos la nueva clase para un mejor estilo
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
                            <button class="btn btn-edit" data-id="${cat.id_categoria}" data-name="${cat.nombre}">Editar</button>
                            <button class="btn btn-delete" data-id="${cat.id_categoria}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

        // Añadir listeners para los botones de editar y eliminar
        container.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', handleEdit);
        });
        container.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDelete);
        });

    } catch (error) {
        container.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

async function handleEdit(event) {
    const id = event.target.dataset.id;
    const currentName = event.target.dataset.name;

    const newName = prompt(`Introduce el nuevo nombre para la categoría "${currentName}":`, currentName);

    if (!newName || newName.trim() === '' || newName === currentName) {
        return; // El usuario canceló o no cambió el nombre
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`${API_ENDPOINT}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ nombre: newName.trim() })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo actualizar la categoría.');
        }

        showToast('Categoría actualizada con éxito.', 'success');
        loadCategories(); // Recargar la lista para mostrar el cambio

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
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

        const response = await fetch(`${API_ENDPOINT}/${id}`, {
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

async function handleAddCategoryForm() {
    const form = document.getElementById('add-category-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Añadiendo...';

        const formData = new FormData(form);
        const categoryData = Object.fromEntries(formData.entries());

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(categoryData)
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Error en el servidor');

            showToast('Categoría añadida con éxito', 'success');
            form.reset();
            loadCategories(); // Recargar la lista
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Añadir Categoría';
        }
    });
}

export async function init() {
    supabase = await getSupabaseClient();
    loadCategories();
    handleAddCategoryForm();
}

// document.addEventListener('DOMContentLoaded', init); // Lo llamará admin.js