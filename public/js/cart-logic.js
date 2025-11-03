const CART_KEY = 'sportifyCart';
import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

/**
 * Obtiene el carrito desde localStorage.
 * @returns {Array} El array de items en el carrito.
 */
export function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

/**
 * Guarda el carrito en localStorage.
 * @param {Array} cart El array de items del carrito a guardar.
 */
export function saveCart(cart) { // Exportar para que otros módulos puedan usarla si es necesario
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/**
 * Añade un producto al carrito o incrementa su cantidad si ya existe.
 * @param {object} product El objeto del producto a añadir.
 */
export function addProductToCart(product) {
    const cart = getCart();
    const existingProductIndex = cart.findIndex(item => item.id_producto === product.id_producto);

    if (existingProductIndex !== -1) {
        cart[existingProductIndex].quantity += 1;
    } else {
        const cartItem = {
            id_producto: product.id_producto,
            nombre: product.nombre,
            precio: product.precio,
            imagen_url: product.imagen_url,
            quantity: 1
        };
        cart.push(cartItem);
    }
    saveCart(cart);
}

/**
 * Actualiza la cantidad de un producto en el carrito.
 * @param {string} productId El ID del producto a actualizar.
 * @param {number} change El cambio en la cantidad (+1, -1, etc.).
 */
export function updateProductQuantity(productId, change) {
    let cart = getCart();
    const productIndex = cart.findIndex(item => Number(item.id_producto) === Number(productId));

    if (productIndex !== -1) {
        cart[productIndex].quantity += change;
        if (cart[productIndex].quantity <= 0) {
            // Eliminar el producto si la cantidad es 0 o menos.
            cart.splice(productIndex, 1);
        }
    }
    saveCart(cart);
}

/**
 * Elimina un producto del carrito por completo.
 * @param {string} productId El ID del producto a eliminar.
 */
export function removeProductFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => Number(item.id_producto) !== Number(productId));
    saveCart(cart);
}

/**
 * Sincroniza el carrito de localStorage con la base de datos.
 * Esta función se llama al iniciar sesión.
 * NOTA: Esta implementación asume que ya no usas las tablas 'carrito' y 'carrito_detalle',
 * ya que el carrito ahora vive en localStorage hasta el momento del checkout.
 */
export async function syncCartOnLogin() {
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // No hacer nada si no hay sesión

    const localCart = getCart();
    
    // Si hubiera lógica de sincronización con DB, iría aquí.
    // Por ahora, el carrito local es la fuente de verdad.
    console.log('Sesión iniciada, carrito local:', localCart);
}

// --- LÓGICA VISUAL DEL CARRITO (MOVIMOS EL CONTENIDO DE cart.js AQUÍ) ---

/**
 * Formatea un número como moneda colombiana (COP).
 * @param {number} amount - El monto a formatear.
 * @returns {string} El monto formateado.
 */
function formatPrice(amount) {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP',
        minimumFractionDigits: 0, // Opcional: para no mostrar centavos si son .00
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Renderiza los items del carrito en la página.
 */
function renderCartPage() {
    const cartContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');
    const goToCheckoutButton = document.getElementById('go-to-checkout-button');

    if (!cartContainer) return; // No hacer nada si no estamos en la página del carrito

    const cart = getCart();
    cartContainer.innerHTML = ''; // Limpiar vista para evitar duplicados

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="cart-empty-message">
                <p>Tu carrito está vacío.</p>
                <a href="/" class="btn btn-primary">Ver productos</a>
            </div>`;
        cartTotalElement.textContent = formatPrice(0);
        if (goToCheckoutButton) goToCheckoutButton.disabled = true;
        return;
    }

    let total = 0;
    cart.forEach(item => {
        // Validación para evitar errores si un item está malformado
        if (!item || typeof item.precio === 'undefined' || typeof item.quantity === 'undefined') {
            console.error('Item inválido en el carrito:', item);
            return; // Saltar este item
        }
        const itemTotal = item.precio * item.quantity;
        total += itemTotal;

        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';
        cartItemElement.innerHTML = `
            <img src="${item.imagen_url}" alt="${item.nombre}" class="cart-item-image">
            <div class="cart-item-details">
                <h4>${item.nombre}</h4>
                <p>Precio: ${formatPrice(item.precio)}</p>
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
    if (goToCheckoutButton) goToCheckoutButton.disabled = false;

}

/**
 * Inicializa los listeners de eventos para la página del carrito.
 * Usa delegación de eventos para mejorar el rendimiento.
 */
function initCartPage() {
    const cartContainer = document.getElementById('cart-items-container');
    const clearCartButton = document.getElementById('clear-cart-button');
    const goToCheckoutButton = document.getElementById('go-to-checkout-button');

    // Si no estamos en la página del carrito, no hacer nada.
    if (!cartContainer) return;

    // Delegación de eventos para botones de cantidad y eliminar
    cartContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button'); // Busca el botón más cercano al clic
        if (!target) return;

        const productId = target.dataset.id;

        if (target.matches('.quantity-btn')) {
            const change = parseInt(target.dataset.change, 10);
            updateProductQuantity(productId, change);
            renderCartPage();
        } else if (target.matches('.remove-btn')) {
            removeProductFromCart(productId);
            showToast('Producto eliminado del carrito.', 'success');
            renderCartPage();
        }
    });

    // Evento para vaciar el carrito
    if (clearCartButton) {
        clearCartButton.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
                saveCart([]);
                renderCartPage();
                showToast('El carrito ha sido vaciado.', 'success');
            }
        });
    }

    // Evento para proceder al checkout
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

    // Renderizar el estado inicial del carrito
    renderCartPage();
}

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', initCartPage);