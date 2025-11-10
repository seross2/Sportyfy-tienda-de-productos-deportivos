import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
const API_ENDPOINT = '/api/marcas';

async function loadBrands() {
    const container = document.getElementById('brands-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando marcas...</p>';
    try {
        const response = await fetch(API_ENDPOINT);
        const brands = await response.json();

        if (brands.length === 0) {
            container.innerHTML = '<p>No hay marcas registradas.</p>';
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
                ${brands.map(brand => `
                    <tr data-id="${brand.id_marca}">
                        <td>${brand.id_marca}</td>
                        <td>${brand.nombre}</td>
                        <td>
                            <button class="btn btn-edit" data-id="${brand.id_marca}" data-name="${brand.nombre}">Editar</button>
                            <button class="btn btn-delete" data-id="${brand.id_marca}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

        container.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', handleEdit));
        container.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', handleDelete));

    } catch (error) {
        container.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

async function handleEdit(event) {
    const id = event.target.dataset.id;
    const currentName = event.target.dataset.name;
    const newName = prompt(`Introduce el nuevo nombre para la marca "${currentName}":`, currentName);

    if (!newName || newName.trim() === '' || newName === currentName) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`${API_ENDPOINT}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ nombre: newName.trim() })
        });

        if (!response.ok) throw new Error((await response.json()).error || 'No se pudo actualizar la marca.');
        showToast('Marca actualizada con éxito.', 'success');
        loadBrands();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function handleDelete(event) {
    const id = event.target.dataset.id;
    if (!confirm(`¿Estás seguro de que quieres eliminar la marca con ID ${id}?`)) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`${API_ENDPOINT}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
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

async function handleAddBrandForm() {
    const form = document.getElementById('add-brand-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        const formData = new FormData(form);
        const brandData = Object.fromEntries(formData.entries());

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify(brandData) });
            if (!response.ok) throw new Error((await response.json()).error || 'Error en el servidor');
            showToast('Marca añadida con éxito', 'success');
            form.reset();
            loadBrands();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}

export async function init() {
    supabase = await getSupabaseClient();
    loadBrands();
    handleAddBrandForm();
}
// document.addEventListener('DOMContentLoaded', init); // Lo llamará admin.js