/**
 * Muestra una notificación (toast) en la pantalla.
 * @param {string} message El mensaje a mostrar.
 * @param {'success' | 'error'} type El tipo de notificación, para el color de fondo.
 */
export function showToast(message, type = 'success') {
    // CORRECCIÓN: El ID del elemento para el toast debe ser consistente.
    const toast = document.getElementById('toast-message'); 
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast-message ${type}`; // Usar clases para el estilo es más limpio
    toast.classList.add('show');

    // Ocultar el toast después de 3 segundos
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}