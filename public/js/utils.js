/**
 * Muestra una notificación (toast) en la pantalla.
 * @param {string} message El mensaje a mostrar.
 * @param {'success' | 'error'} type El tipo de notificación, para el color de fondo.
 */
export function showToast(message, type = 'success') {
    const toast = document.getElementById('message');
    if (!toast) return;

    toast.textContent = message;
    toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    toast.style.display = 'block';

    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}