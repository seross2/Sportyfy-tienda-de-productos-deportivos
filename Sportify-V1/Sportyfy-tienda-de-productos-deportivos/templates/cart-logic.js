const CART_KEY = 'sportifyCart';

/**
 * Obtiene el carrito completo desde localStorage.
 * @returns {Array} El array de items en el carrito.
 */
export function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

/**
 * Guarda el carrito completo en localStorage.
 * @param {Array} cart El array de items del carrito a guardar.
 */
function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/**
 * Añade un producto al carrito o incrementa su cantidad.
 * @param {object} product El objeto del producto a añadir.
 */
export function addProductToCart(product) {
    const cart = getCart();
    const existingProductIndex = cart.findIndex(item => item.id_producto === product.id_producto);

    if (existingProductIndex !== -1) {
        cart[existingProductIndex].quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    saveCart(cart);
}

/**
 * Permite actualizar la cantidad de un producto o eliminarlo.
 * @param {string} productId El ID del producto a actualizar.
 * @param {number} change El cambio en la cantidad (+1, -1, etc.).
 */
export function updateProductQuantity(productId, change) {
    let cart = getCart();
    const productIndex = cart.findIndex(item => item.id_producto === Number(productId));

    if (productIndex !== -1) {
        cart[productIndex].quantity += change;
        if (cart[productIndex].quantity <= 0) {
            cart = cart.filter(item => item.id_producto !== Number(productId));
        }
    }
    saveCart(cart);
}

/**
 * Elimina un producto del carrito, sin importar la cantidad.
 * @param {string} productId El ID del producto a eliminar.
 */
export function removeProductFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id_producto !== Number(productId));
    saveCart(cart);
}