import { getSupabaseClient } from '/supabaseClient.js';
import { showToast } from '/utils.js';

const checkoutForm = document.getElementById('checkout-form');
const payButton = document.getElementById('pay-button');
const summaryItemsContainer = document.getElementById('summary-items');
const summaryTotalElement = document.getElementById('summary-total');

const CART_KEY = 'sportifyCart'; // Clave consistente para el carrito

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

function displayOrderSummary() {
    const cart = getCart();
    if (cart.length === 0) {
        summaryItemsContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
        payButton.disabled = true;
        return;
    }

    let total = 0;
    summaryItemsContainer.innerHTML = cart.map(item => {
        const itemTotal = item.precio * item.quantity; // Calcular el total en centavos
        total += itemTotal;
        return `
            <div class="summary-item">
                <span>${item.nombre} (x${item.quantity})</span>
                <strong>$${(itemTotal / 100).toFixed(2)}</strong>
            </div>
        `;
    }).join('');

    summaryTotalElement.textContent = `$${(total / 100).toFixed(2)}`;
}

async function handleCheckout(e) {
    e.preventDefault();
    payButton.disabled = true;
    payButton.textContent = 'Procesando...';

    const supabase = await getSupabaseClient();
    if (!supabase) {
        showToast('Error de configuración.', 'error');
        payButton.disabled = false;
        payButton.textContent = 'Pagar con Stripe';
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        showToast('Debes iniciar sesión para realizar un pedido.', 'error');
        window.location.href = '/login.html';
        return;
    }

    const cart = getCart();
    const formData = new FormData(checkoutForm);
    const orderData = {
        items: cart,
        direccion_envio: formData.get('direccion_envio'),
        telefono_contacto: formData.get('telefono_contacto'),
        notas: formData.get('notas'),
    };

    try {
         const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo procesar el pedido.');
        }

        const { url } = await response.json();
        localStorage.removeItem(CART_KEY); // Limpiar el carrito después de crear el pedido
        window.location.href = url; // Redirigir a Stripe

    } catch (error) {
        showToast(error.message, 'error');
        payButton.disabled = false;
        payButton.textContent = 'Pagar con Stripe';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    displayOrderSummary();
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckout);
    }
});