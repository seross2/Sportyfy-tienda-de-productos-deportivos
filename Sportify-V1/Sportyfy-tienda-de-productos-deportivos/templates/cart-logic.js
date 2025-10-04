const CART_KEY = 'sportifyCart';
import { getSupabaseClient } from '/supabaseClient.js';


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