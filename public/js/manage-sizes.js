import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
const API_ENDPOINT = '/api/tallas';

async function loadSizes() {
    const container = document.getElementById('sizes-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando tallas...</p>';
    try {
        const response = await fetch(API_ENDPOINT);
        const sizes = await response.json();

        if (sizes.length === 0) {
            container.innerHTML = '<p>No hay tallas registradas.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'admin-table';
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
                            <button class="btn btn-edit" data-id="${size.id_talla}" data-tipo="${size.tipo}" data-valor="${size.valor}">Editar</button>
                            <button class="btn btn-delete" data-id="${size.id_talla}">Eliminar</button>
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
        container.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

async function handleEdit(event) {
    const id = event.target.dataset.id;
    const currentTipo = event.target.dataset.tipo;
    const currentValor = event.target.dataset.valor;

    const newTipo = prompt(`Introduce el nuevo tipo para la talla (actual: ${currentTipo}):`, currentTipo);
    if (newTipo === null) return; // El usuario canceló

    const newValor = prompt(`Introduce el nuevo valor para la talla (actual: ${currentValor}):`, currentValor);
    if (newValor === null) return; // El usuario canceló

    if ((!newTipo || newTipo.trim() === '') && (!newValor || newValor.trim() === '')) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`${API_ENDPOINT}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ tipo: newTipo.trim(), valor: newValor.trim() })
        });

        if (!response.ok) throw new Error((await response.json()).error || 'No se pudo actualizar la talla.');
        showToast('Talla actualizada con éxito.', 'success');
        loadSizes();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function handleDelete(event) {
    const id = event.target.dataset.id;
    if (!confirm(`¿Estás seguro de que quieres eliminar la talla con ID ${id}?`)) return;

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

async function handleAddSizeForm() {
    const form = document.getElementById('add-size-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        const formData = new FormData(form);
        const sizeData = Object.fromEntries(formData.entries());

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify(sizeData) });
            if (!response.ok) throw new Error((await response.json()).error || 'Error en el servidor');
            showToast('Talla añadida con éxito', 'success');
            form.reset();
            loadSizes();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}

export async function init() {
    supabase = await getSupabaseClient();
    loadSizes();
    handleAddSizeForm();
}

// document.addEventListener('DOMContentLoaded', init); // Lo llamará admin.js