import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';
import '/js/global.js'; // Asegura que el menú se cargue en la página del carrito

class ShoppingCart {
    constructor() {
        this.CART_KEY = 'sportifyCart';
    }

    /**
     * Obtiene el carrito desde localStorage.
     * @returns {Array} El array de items en el carrito.
     */
    getCart() {
        return JSON.parse(localStorage.getItem(this.CART_KEY)) || [];
    }

    /**
     * Guarda el carrito en localStorage.
     * @param {Array} cart El array de items del carrito a guardar.
     */
    saveCart(cart) {
        localStorage.setItem(this.CART_KEY, JSON.stringify(cart));
    }

    /**
     * Añade un producto al carrito o incrementa su cantidad si ya existe.
     * @param {object} product El objeto del producto a añadir.
     * @param {number} quantity La cantidad a añadir (por defecto 1).
     */
    addProduct(product, quantity = 1) {
        const cart = this.getCart();
        // CAMBIO: Usamos id_variacion como identificador único
        const existingProductIndex = cart.findIndex(item => item.id_variacion === product.id_variacion);

        if (existingProductIndex !== -1) {
            cart[existingProductIndex].quantity += quantity;
        } else {
            const cartItem = {
                id_variacion: product.id_variacion,
                nombre: product.nombre,
                precio: product.precio,
                imagen_url: product.imagen_url,
                quantity: quantity
            };
            cart.push(cartItem);
        }
        this.saveCart(cart);
    }

    /**
     * Actualiza la cantidad de un producto en el carrito.
     * @param {string} variationId El ID de la variación a actualizar.
     * @param {number} change El cambio en la cantidad (+1, -1, etc.).
     */
    updateQuantity(variationId, change) {
        let cart = this.getCart();
        const productIndex = cart.findIndex(item => Number(item.id_variacion) === Number(variationId));

        if (productIndex !== -1) {
            // Validar stock antes de incrementar
            if (change > 0) {
                const item = cart[productIndex];
                if (item.stock !== undefined && item.quantity + change > item.stock) {
                    showToast(`No puedes añadir más. Stock máximo: ${item.stock}`, 'error');
                    return;
                }
            }

            cart[productIndex].quantity += change;
            if (cart[productIndex].quantity <= 0) {
                // Eliminar el producto si la cantidad es 0 o menos.
                cart.splice(productIndex, 1);
            }
        }
        this.saveCart(cart);
    }

    /**
     * Elimina un producto del carrito por completo.
     * @param {string} variationId El ID de la variación a eliminar.
     */
    removeProduct(variationId) {
        let cart = this.getCart();
        cart = cart.filter(item => Number(item.id_variacion) !== Number(variationId));
        this.saveCart(cart);
    }

    /**
     * Sincroniza el carrito de localStorage con la base de datos.
     */
    async syncOnLogin() {
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // No hacer nada si no hay sesión

        const localCart = this.getCart();
        console.log('Sesión iniciada, carrito local:', localCart);
    }

    /**
     * Formatea un número como moneda colombiana (COP).
     */
    formatPrice(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    /**
     * Renderiza los items del carrito en la página.
     */
    renderPage() {
        const cartContainer = document.getElementById('cart-items-container');
        const cartTotalElement = document.getElementById('cart-total');
        const goToCheckoutButton = document.getElementById('go-to-checkout-button');

        if (!cartContainer) return; // No hacer nada si no estamos en la página del carrito

        const cart = this.getCart();
        cartContainer.innerHTML = ''; // Limpiar vista para evitar duplicados

        if (cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="cart-empty-message">
                    <p>Tu carrito está vacío.</p>
                    <a href="/" class="btn btn-primary">Ver productos</a>
                </div>`;
            if (cartTotalElement) cartTotalElement.textContent = this.formatPrice(0);
            if (goToCheckoutButton) goToCheckoutButton.disabled = true;
            return;
        }

        let total = 0;
        cart.forEach(item => {
            if (!item || typeof item.precio === 'undefined' || typeof item.quantity === 'undefined') {
                console.error('Item inválido en el carrito:', item);
                return; 
            }
            const itemTotal = item.precio * item.quantity;
            total += itemTotal;

            const cartItemElement = document.createElement('div');
            cartItemElement.className = 'cart-item';
            cartItemElement.innerHTML = `
                <img src="${item.imagen_url}" alt="${item.nombre}" class="cart-item-image">
                <div class="cart-item-details">
                    <h4>${item.nombre}</h4>
                    <p>Precio: ${this.formatPrice(item.precio)}</p>
                    <div class="quantity-controls">
                        <button class="quantity-btn" data-id="${item.id_variacion}" data-change="-1">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" data-id="${item.id_variacion}" data-change="1">+</button>
                    </div>
                </div>
                <div class="cart-item-total">
                    <p>${this.formatPrice(itemTotal)}</p>
                    <button class="remove-btn" data-id="${item.id_variacion}">Eliminar</button>
                </div>
            `;
            cartContainer.appendChild(cartItemElement);
        });

        if (cartTotalElement) cartTotalElement.textContent = this.formatPrice(total);
        if (goToCheckoutButton) goToCheckoutButton.disabled = false;
    }

    /**
     * Inicializa los listeners de eventos para la página del carrito.
     */
    init() {
        const cartContainer = document.getElementById('cart-items-container');
        const clearCartButton = document.getElementById('clear-cart-button');
        const goToCheckoutButton = document.getElementById('go-to-checkout-button');

        if (!cartContainer) return;

        cartContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const variationId = target.dataset.id;

            if (target.matches('.quantity-btn')) {
                const change = parseInt(target.dataset.change, 10);
                this.updateQuantity(variationId, change);
                this.renderPage();
            } else if (target.matches('.remove-btn')) {
                this.removeProduct(variationId);
                showToast('Producto eliminado del carrito.', 'success');
                this.renderPage();
            }
        });

        if (clearCartButton) {
            clearCartButton.addEventListener('click', () => {
                if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
                    this.saveCart([]);
                    this.renderPage();
                    showToast('El carrito ha sido vaciado.', 'success');
                }
            });
        }

        if (goToCheckoutButton) {
            goToCheckoutButton.addEventListener('click', async () => {
                const supabase = await getSupabaseClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    showToast('Debes iniciar sesión para continuar.', 'error');
                    window.location.href = `/login.html?redirect=/envio.html`;
                } else {
                    window.location.href = '/envio.html';
                }
            });
        }
        this.renderPage();
    }
}

const shoppingCart = new ShoppingCart();
document.addEventListener('DOMContentLoaded', () => shoppingCart.init());

export { shoppingCart };