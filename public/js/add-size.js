import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

function handleAddSizeForm() {
    const form = document.getElementById('add-size-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        const formData = new FormData(form);
        const sizeData = {
            tipo: formData.get('tipo'),
            valor: formData.get('valor')
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sesión no válida.');

            const response = await fetch('/api/tallas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(sizeData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en el servidor.');
            }

            showToast('Talla añadida con éxito.', 'success');
            setTimeout(() => {
                window.location.href = '/manage-sizes.html';
            }, 1500);

        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Guardar Talla';
        }
    });
}

async function initPage() {
    supabase = await getSupabaseClient();
    handleAddSizeForm();
}

document.addEventListener('DOMContentLoaded', initPage);