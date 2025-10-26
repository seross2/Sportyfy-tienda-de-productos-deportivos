import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

function handleAddCategoryForm() {
    const form = document.getElementById('add-category-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        const formData = new FormData(form);
        const categoryData = {
            nombre: formData.get('nombre')
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión no válida.');

            const response = await fetch('/api/categorias', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(categoryData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en el servidor.');
            }

            showToast('Categoría añadida con éxito.', 'success');
            setTimeout(() => {
                window.location.href = '/manage-categories.html';
            }, 1500);

        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Guardar Categoría';
        }
    });
}

async function initPage() {
    supabase = await getSupabaseClient();
    // La protección de la ruta ya la hace auth.js y el middleware del servidor.
    handleAddCategoryForm();
}

document.addEventListener('DOMContentLoaded', initPage);