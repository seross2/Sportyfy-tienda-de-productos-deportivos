import { shoppingCart } from '/js/cart-logic.js';
import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';
import '/js/global.js';

async function initCheckout() {
    // 1. Verificar autenticación
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html?redirect=/envio.html';
        return;
    }

    // 2. Cargar carrito y calcular total
    const cart = shoppingCart.getCart();
    if (cart.length === 0) {
        showToast('Tu carrito está vacío.', 'error');
        setTimeout(() => window.location.href = '/', 1500);
        return;
    }

    const totalElement = document.getElementById('checkout-total');
    if (totalElement) {
        const total = cart.reduce((acc, item) => acc + (item.precio * item.quantity), 0);
        totalElement.textContent = shoppingCart.formatPrice(total);
    }

    // 3. Manejar el envío del formulario
    const form = document.getElementById('checkout-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // IMPORTANTE: Evita que la página se recargue
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando...';

            const formData = new FormData(form);
            const orderData = {
                items: cart,
                direccion_envio: formData.get('direccion'),
                telefono_contacto: formData.get('telefono'),
                notas: formData.get('notas')
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

                const result = await response.json();

                if (!response.ok) throw new Error(result.error || 'Error al procesar el pedido');

                if (result.url) {
                    window.location.href = result.url; // Redirigir a Stripe
                } else {
                    throw new Error('Error de configuración de pago');
                }
            } catch (error) {
                console.error(error);
                showToast(error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Pagar y Finalizar';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initCheckout);