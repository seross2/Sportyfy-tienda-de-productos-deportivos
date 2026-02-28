import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
const API_ENDPOINT = '/api/categorias';

async function loadCategories() {
    const container = document.getElementById('categories-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando categorías...</p>';
    try {
        const response = await fetch('/api/categorias');
        if (!response.ok) throw new Error('No se pudieron cargar las categorías.');
        const categories = await response.json();

        if (categories.length === 0) {
            container.innerHTML = '<p>No hay categorías registradas.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'admin-table';
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
                            <button class="btn btn-edit" data-id="${cat.id_categoria}">Editar</button>
                            <button class="btn btn-delete" data-id="${cat.id_categoria}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

        container.querySelectorAll('.btn-edit').forEach(button => button.addEventListener('click', handleEdit));
        container.querySelectorAll('.btn-delete').forEach(button => button.addEventListener('click', handleDelete));
    } catch (error) {
        container.innerHTML = `<p>Error al cargar categorías: ${error.message}</p>`;
    }
}

async function handleEdit(event) {
    const id = event.target.dataset.id;
    const currentName = event.target.closest('tr').querySelector('td:nth-child(2)').textContent;
    const newName = prompt('Introduce el nuevo nombre para la categoría:', currentName);

    if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`/api/categorias/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ nombre: newName })
            });
            if (!response.ok) throw new Error('No se pudo actualizar la categoría.');
            showToast('Categoría actualizada con éxito.', 'success');
            loadCategories();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
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
        loadCategories();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

function handleAddCategoryForm() {
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
        // Lógica para añadir categoría (ya está en admin.js, pero la centralizamos aquí)
    });
}

export async function init() {
    supabase = await getSupabaseClient();
    if (!document.getElementById('categories-list-container')) return;
    loadCategories();
    handleAddCategoryForm();
    // La lógica de añadir ya está en admin.js, pero si la movemos, la llamaríamos aquí
    // handleAddCategoryForm(); 
}

// document.addEventListener('DOMContentLoaded', init); // Lo llamará admin.js