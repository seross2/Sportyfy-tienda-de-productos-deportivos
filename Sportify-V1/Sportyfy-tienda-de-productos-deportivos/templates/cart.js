import { showToast } from '/utils.js';

const cartItemsContainer = document.getElementById('cart-items-container');
const cartTotalElement = document.getElementById('cart-total');
const clearCartButton = document.getElementById('clear-cart-button');
const goToCheckoutButton = document.getElementById('go-to-checkout-button');
const CART_KEY = 'sportifyCart'; // Usaremos una clave consistente

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function displayCart() {
    const cart = getCart();
    if (!cartItemsContainer || !cartTotalElement) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
        cartTotalElement.textContent = '$0.00';
        if (clearCartButton) clearCartButton.style.display = 'none';
        if (goToCheckoutButton) goToCheckoutButton.style.display = 'none';
    } else {
        let total = 0;
        cartItemsContainer.innerHTML = cart.map(item => {
            const subtotal = (item.precio / 100) * item.quantity;
            total += subtotal;
            return `
                <div class="cart-item">
                    <img src="${item.imagen_url}" alt="${item.nombre}" width="100">
                    <div class="item-details">
                        <h3>${item.nombre}</h3>
                        <p>Cantidad: ${item.quantity}</p>
                    </div>
                    <p class="item-subtotal"><strong>$${subtotal.toFixed(2)}</strong></p>
                </div>
            `;
        }).join('');
        cartTotalElement.textContent = `$${total.toFixed(2)}`;
        if (clearCartButton) clearCartButton.style.display = 'block';
        if (goToCheckoutButton) goToCheckoutButton.style.display = 'block';
    }
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    displayCart();
    showToast('El carrito ha sido vaciado.', 'success');
}

function goToCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        showToast('Tu carrito está vacío.', 'error');
        return;
    }
    
    // Redirige a la página del formulario de envío
    window.location.href = '/checkout.html';
}

// Asignar eventos a los botones
if (clearCartButton) {
    clearCartButton.addEventListener('click', clearCart);
}

if (goToCheckoutButton) {
    goToCheckoutButton.addEventListener('click', goToCheckout);
}

// Mostrar el carrito cuando la página cargue
document.addEventListener('DOMContentLoaded', displayCart);
