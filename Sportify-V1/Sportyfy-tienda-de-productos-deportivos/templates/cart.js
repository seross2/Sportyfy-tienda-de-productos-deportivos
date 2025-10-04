import { getSupabaseClient } from '/supabaseClient.js';
import { showToast } from '/utils.js';
import { getCart, updateProductQuantity, removeProductFromCart } from '/cart-logic.js';

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabaseClient();
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartSummary = document.getElementById('cart-summary');
    const checkoutButton = document.getElementById('checkout-button');
    const itemTemplate = document.getElementById('cart-item-template');

    function renderCart() {
        const cart = getCart();
        cartItemsContainer.innerHTML = '';

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
            cartSummary.innerHTML = '';
            checkoutButton.style.display = 'none';
            return;
        }

        let total = 0;
        checkoutButton.style.display = 'block';

        if (!itemTemplate) return; // Salir si la plantilla no existe

        cart.forEach((item) => {
            const subtotal = item.precio * item.quantity;
            total += subtotal;

            const templateClone = itemTemplate.content.cloneNode(true);
            const itemElement = templateClone.querySelector('.cart-item');

            itemElement.querySelector('.item-image').src = item.imagen_url;
            itemElement.querySelector('.item-image').alt = item.nombre;
            itemElement.querySelector('.item-name').textContent = item.nombre;
            itemElement.querySelector('.item-price').textContent = `Precio: $${(item.precio / 100).toFixed(2)}`;
            itemElement.querySelector('.item-quantity').textContent = item.quantity;
            itemElement.querySelector('.item-subtotal').textContent = `Subtotal: $${(subtotal / 100).toFixed(2)}`;

            // Asignar el ID del producto a los botones para que funcionen los eventos
            itemElement.querySelector('.decrease-btn').dataset.id = item.id_producto;
            itemElement.querySelector('.increase-btn').dataset.id = item.id_producto;
            itemElement.querySelector('.remove-btn').dataset.id = item.id_producto;

            cartItemsContainer.appendChild(templateClone);
        });

        cartSummary.innerHTML = `<h3>Total: $${(total / 100).toFixed(2)}</h3>`;
    }

    checkoutButton.addEventListener('click', async () => {
        const cart = getCart();
        if (cart.length === 0) return showToast("Tu carrito está vacío.", "error");

        if (!supabase) return showToast("Error de configuración. No se puede proceder al pago.", "error");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            showToast("Debes iniciar sesión para poder pagar.", "error");
            window.location.href = '/login.html';
            return;
        }

        checkoutButton.textContent = 'Procesando...';
        checkoutButton.disabled = true;

        fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ items: cart })
        })
        .then(res => res.ok ? res.json() : res.json().then(err => Promise.reject(err)))
        .then(({ url }) => {
            window.location.href = url;
        })
        .catch(error => {
            console.error('Error en el pago:', error);
            showToast(`Error al procesar el pago: ${error.error || 'Intenta de nuevo.'}`, 'error');
            checkoutButton.textContent = 'Pagar ahora';
            checkoutButton.disabled = false;
        });
    });

    // --- Delegación de Eventos ---
    // Un solo listener en el contenedor para manejar todos los clics internos.
    cartItemsContainer.addEventListener('click', (event) => {
        const target = event.target;
        const productId = target.dataset.id;

        if (target.matches('.quantity-btn')) {
            const change = parseInt(target.dataset.change, 10);
            updateProductQuantity(productId, change);
            renderCart(); // Volver a renderizar después de actualizar
        }

        if (target.matches('.remove-btn')) {
            removeProductFromCart(productId);
            renderCart(); // Volver a renderizar después de actualizar
        }
    });

    renderCart();
});