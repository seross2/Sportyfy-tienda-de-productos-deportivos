import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
let isEditMode = false;
let sizeIdToEdit = null;

/**
 * Carga y muestra las tallas en la tabla.
 */
async function loadSizes() {
    const container = document.getElementById('sizes-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando tallas...</p>';

    try {
        const response = await fetch(`/api/tallas?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) throw new Error('Error al cargar las tallas');
        const tallas = await response.json();

        if (tallas.length === 0) {
            container.innerHTML = '<p>No hay tallas registradas.</p>';
            return;
        }

        tallas.sort((a, b) => a.id_talla - b.id_talla);

        const table = document.createElement('table');
        table.className = 'admin-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Categoría</th>
                    <th>Valor</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${tallas.map(talla => `
                    <tr data-id="${talla.id_talla}">
                        <td>${talla.id_talla}</td>
                        <td>${talla.categorias?.nombre || 'N/A'}</td>
                        <td>${talla.valor}</td>
                        <td>
                            <button class="btn btn-edit" 
                                data-id="${talla.id_talla}" 
                                data-valor="${talla.valor}"
                                data-categoria-id="${talla.id_categoria || ''}">
                                Editar
                            </button>
                            <button class="btn btn-delete" data-id="${talla.id_talla}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.innerHTML = '';
        container.appendChild(table);

        // Add event listeners
        container.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', handleEditClick));
        container.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', handleDeleteClick));

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p>Error al cargar la lista de tallas.</p>';
    }
}

/**
 * Prepara el formulario para editar una talla.
 */
function handleEditClick(event) {
    const button = event.target;
    sizeIdToEdit = button.dataset.id;
    isEditMode = true;

    const formContainer = document.getElementById('add-size-container');
    const form = document.getElementById('add-size-form');
    const title = formContainer.querySelector('h3');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Populate form fields
    form.querySelector('[name="id_categoria"]').value = button.dataset.categoriaId;
    form.querySelector('[name="valor"]').value = button.dataset.valor;

    // Update UI for edit mode
    title.textContent = 'Editar Talla';
    submitBtn.textContent = 'Actualizar Talla';
    formContainer.classList.remove('hidden');
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Elimina una talla.
 */
async function handleDeleteClick(event) {
    const id = event.target.dataset.id;
    if (!confirm(`¿Estás seguro de eliminar la talla con ID ${id}?`)) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/tallas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (response.ok) {
            showToast('Talla eliminada con éxito', 'success');
            loadSizes(); // Reload the list
        } else {
            const err = await response.json();
            throw new Error(err.details || 'No se pudo eliminar la talla.');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Maneja el envío del formulario (Crear o Editar).
 */
function handleSizeFormSubmit() {
    const form = document.getElementById('add-size-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const formData = new FormData(form);
        const sizeData = {
            id_categoria: formData.get('id_categoria'),
            valor: formData.get('valor')
        };

        const url = isEditMode ? `/api/tallas/${sizeIdToEdit}` : '/api/tallas';
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(sizeData)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.details || 'Error al guardar la talla');
            }

            showToast(isEditMode ? 'Talla actualizada con éxito' : 'Talla añadida con éxito', 'success');
            
            form.reset();
            isEditMode = false;
            sizeIdToEdit = null;
            
            const formContainer = form.closest('.card');
            if (formContainer) {
                formContainer.classList.add('hidden');
                formContainer.querySelector('h3').textContent = 'Añadir Nueva Talla';
            }
            submitBtn.textContent = isEditMode ? 'Actualizar Talla' : 'Añadir Talla';

            loadSizes(); // Reload the list
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

/**
 * Inicializa el módulo de gestión de tallas.
 */
export async function init() {
    supabase = await getSupabaseClient();
    if (!document.getElementById('sizes-list-container')) return;

    loadSizes();
    handleSizeFormSubmit();
}