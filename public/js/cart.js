import { getCart, updateProductQuantity, removeProductFromCart, saveCart } from '/js/cart-logic.js';
import { showToast } from '/js/utils.js';
import { getSupabaseClient } from '/js/supabaseClient.js';

const cartContainer = document.getElementById('cart-items-container');
const cartTotalElement = document.getElementById('cart-total');
const goToCheckoutButton = document.getElementById('go-to-checkout-button');
const clearCartButton = document.getElementById('clear-cart-button');

function renderCart() {
    const cart = getCart();
    cartContainer.innerHTML = ''; // Limpiar vista

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
        cartTotalElement.textContent = formatPrice(0);
        goToCheckoutButton.disabled = true;
        return;
    }

    let total = 0;
    cart.forEach(item => {
        const itemTotal = (item.precio / 100) * item.quantity;
        total += itemTotal;

        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';
        cartItemElement.innerHTML = `
            <img src="${item.imagen_url}" alt="${item.nombre}" class="cart-item-image">
            <div class="cart-item-details">
                <h4>${item.nombre}</h4>
                <p>Precio: ${formatPrice(item.precio / 100)}</p>
                <div class="quantity-controls">
                    <button class="quantity-btn" data-id="${item.id_producto}" data-change="-1">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" data-id="${item.id_producto}" data-change="1">+</button>
                </div>
            </div>
            <div class="cart-item-total">
                <p>${formatPrice(itemTotal)}</p>
                <button class="remove-btn" data-id="${item.id_producto}">Eliminar</button>
            </div>
        `;
        cartContainer.appendChild(cartItemElement);
    });

    cartTotalElement.textContent = formatPrice(total);
    goToCheckoutButton.disabled = false;

    // Añadir eventos a los botones
    document.querySelectorAll('.quantity-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const change = parseInt(e.target.dataset.change, 10);
            updateProductQuantity(id, change);
            renderCart(); // Volver a dibujar el carrito
        });
    });

    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            removeProductFromCart(id);
            showToast('Producto eliminado del carrito.', 'success');
            renderCart();
        });
    });
}

function formatPrice(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
}

clearCartButton.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        saveCart([]); // Guarda un carrito vacío
        renderCart();
        showToast('El carrito ha sido vaciado.', 'success');
    }
});

// Inicia el proceso de checkout
goToCheckoutButton.addEventListener('click', async () => {
    goToCheckoutButton.disabled = true;
    goToCheckoutButton.textContent = 'Procesando...';

    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        showToast('Debes iniciar sesión para hacer un pedido.', 'error');
        window.location.href = '/login.html';
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        showToast('Tu carrito está vacío.', 'error');
        goToCheckoutButton.disabled = false;
        goToCheckoutButton.textContent = 'Hacer Pedido';
        return;
    }

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            // TODO: Recopilar dirección, teléfono, etc., desde un formulario. Por ahora, usamos datos de ejemplo.
            body: JSON.stringify({ items: cart, direccion_envio: 'Calle Falsa 123', telefono_contacto: '3001234567', notas: '' })
        });

        const { url, error } = await response.json();
        if (error) throw new Error(error);

        // Redirigir al usuario a la página de pago de Stripe
        window.location.href = url;
    } catch (err) {
        showToast(`Error al crear el pedido: ${err.message}`, 'error');
        goToCheckoutButton.disabled = false;
        goToCheckoutButton.textContent = 'Hacer Pedido';
    }
});

document.addEventListener('DOMContentLoaded', renderCart);