import { getCart } from '/js/cart-logic.js';
import { getSupabaseClient } from '/js/supabaseClient.js';

const shippingForm = document.getElementById('shipping-form');
const summaryCartItems = document.getElementById('summary-cart-items');
const summaryCartTotal = document.getElementById('summary-cart-total');
const continueToPaymentBtn = document.getElementById('continue-to-payment-btn');

function formatPrice(amount) {
    // CORRECCIÓN: El precio viene en centavos, hay que dividirlo por 100 para mostrarlo en pesos.
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP',
        minimumFractionDigits: 0 
    }).format(amount / 100);
}

function renderOrderSummary() {
    const cart = getCart();
    if (!summaryCartItems || !summaryCartTotal) return;

    if (cart.length === 0) {
        summaryCartItems.innerHTML = '<p>No hay productos en tu carrito.</p>';
        summaryCartTotal.textContent = formatPrice(0);
        continueToPaymentBtn.disabled = true;
        return;
    }

    let total = 0;
    summaryCartItems.innerHTML = cart.map(item => {
        const itemTotal = item.precio * item.quantity;
        total += itemTotal;
        return `
            <div class="summary-item">
                <span>${item.nombre} (x${item.quantity})</span>
                <span>${formatPrice(itemTotal)}</span>
            </div>
        `;
    }).join('');

    summaryCartTotal.textContent = formatPrice(total);
}

async function handleFormSubmit(event) {
    event.preventDefault();
    continueToPaymentBtn.disabled = true;
    continueToPaymentBtn.textContent = 'Procesando...';

    const supabase = await getSupabaseClient();
    if (!supabase) {
        alert('Error de configuración. No se pudo conectar.');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
        window.location.href = '/login.html';
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        alert('Tu carrito está vacío.');
        window.location.href = '/';
        return;
    }

    const formData = new FormData(shippingForm);
    const shippingData = {
        items: cart,
        direccion_envio: formData.get('direccion_envio'),
        telefono_contacto: formData.get('telefono_contacto'),
        notas: formData.get('notas')
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(shippingData)
        });

        const { url, error } = await response.json();

        if (error) {
            throw new Error(error);
        }

        // Redirigir al usuario a la página de pago de Stripe
        window.location.href = url;

    } catch (err) {
        alert(`Error al crear el pedido: ${err.message}`);
        continueToPaymentBtn.disabled = false;
        continueToPaymentBtn.textContent = 'Continuar a Pagar';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderOrderSummary();
    if (shippingForm) {
        shippingForm.addEventListener('submit', handleFormSubmit);
    }
});