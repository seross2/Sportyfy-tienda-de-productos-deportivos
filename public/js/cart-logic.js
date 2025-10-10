const CART_KEY = 'sportifyCart';
import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';



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
export function saveCart(cart) { // Exportar para que otros módulos puedan usarla si es necesario
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
    // CORRECCIÓN: Convertir ambos IDs a número para una comparación segura.
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
 * Elimina un producto del carrito, sin importar la cantidad.
 * @param {string} productId El ID del producto a eliminar.
 */
export function removeProductFromCart(productId) {
    let cart = getCart();
    // CORRECCIÓN: Convertir ambos IDs a número para una comparación segura.
    cart = cart.filter(item => Number(item.id_producto) !== Number(productId));
    saveCart(cart);
}

/**
 * Sincroniza el carrito de localStorage con la base de datos.
 * Esta función se llama al iniciar sesión.
 */
export async function syncCartOnLogin() {
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // No hacer nada si no hay sesión

    const localCart = getCart();

    // 1. Obtener el carrito de la base de datos
    const { data: dbCart, error: fetchError } = await supabase.rpc('get_user_cart', {
        p_id_usuario: session.user.id
    });

    if (fetchError) {
        console.error("Error al obtener el carrito de la DB:", fetchError);
        return;
    }

    // 2. Combinar el carrito local con el de la base de datos
    const combinedCart = [...dbCart];

    localCart.forEach(localItem => {
        const existingItemIndex = combinedCart.findIndex(dbItem => dbItem.id_producto === localItem.id_producto);
        if (existingItemIndex !== -1) {
            // Si el producto ya existe, actualizamos la cantidad (podríamos usar la más alta, o sumar, aquí sumamos)
            combinedCart[existingItemIndex].quantity += localItem.quantity;
        } else {
            // Si es un producto nuevo del carrito local, lo añadimos
            combinedCart.push(localItem);
        }
    });

    // 3. Guardar el carrito combinado en localStorage (nuestra fuente de verdad en el cliente)
    saveCart(combinedCart);

    // 4. Actualizar la base de datos con el carrito combinado
    await syncLocalCartToDB(session.user.id, combinedCart);
}

/**
 * Guarda el estado actual del carrito local en la base de datos.
 */
async function syncLocalCartToDB(userId, cart) {
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    const productosParaSync = cart.map(item => ({
        id_producto: item.id_producto,
        cantidad: item.quantity
    }));

    const { error } = await supabase.rpc('sincronizar_carrito', {
        p_id_usuario: userId,
        p_productos: productosParaSync
    });

    if (error) console.error("Error sincronizando el carrito a la DB:", error);
}

// --- LÓGICA VISUAL DEL CARRITO (MOVIMOS EL CONTENIDO DE cart.js AQUÍ) ---

function formatPrice(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
}

/**
 * Renderiza los items del carrito en la página.
 */
export function renderCartPage() {
    const cartContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');
    const goToCheckoutButton = document.getElementById('go-to-checkout-button');

    if (!cartContainer) return; // No hacer nada si no estamos en la página del carrito

    const cart = getCart();
    cartContainer.innerHTML = ''; // Limpiar vista

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
        cartTotalElement.textContent = formatPrice(0);
        if (goToCheckoutButton) goToCheckoutButton.disabled = true;
        return;
    }

    let total = 0;
    cart.forEach(item => {
        // Asegurarse de que los datos son válidos antes de renderizar
        if (!item || typeof item.precio === 'undefined' || typeof item.quantity === 'undefined') {
            console.error('Item inválido en el carrito:', item);
            return; // Saltar este item
        }
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
    if (goToCheckoutButton) goToCheckoutButton.disabled = false;

    // --- Delegación de eventos para los botones del carrito ---
    cartContainer.addEventListener('click', (e) => {
        const target = e.target;
        const productId = target.dataset.id;

        if (target.matches('.quantity-btn')) {
            const change = parseInt(target.dataset.change, 10);
            updateProductQuantity(productId, change);
            renderCartPage(); // Volver a dibujar el carrito
        }

        if (target.matches('.remove-btn')) {
            removeProductFromCart(productId);
            showToast('Producto eliminado del carrito.', 'success');
            renderCartPage();
        }
    });
}

// Inicializar la página del carrito si los elementos existen
const clearCartButton = document.getElementById('clear-cart-button');
if (clearCartButton) {
    clearCartButton.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
            saveCart([]);
            renderCartPage();
            showToast('El carrito ha sido vaciado.', 'success');
        }
    });
}

// --- LÓGICA DE CHECKOUT ---
const goToCheckoutButton = document.getElementById('go-to-checkout-button');
if (goToCheckoutButton) {
  goToCheckoutButton.addEventListener('click', async () => {
    const cart = getCart();
    if (cart.length === 0) {
      showToast('Tu carrito está vacío.', 'error');
      return;
    }

    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showToast('Debes iniciar sesión para continuar.', 'error');
      window.location.href = '/login.html?redirect=/envio.html'; // Redirigir al login y luego al envío
      return;
    }

    // Redirigir a la página de detalles de envío
    window.location.href = '/envio.html';
  });
}