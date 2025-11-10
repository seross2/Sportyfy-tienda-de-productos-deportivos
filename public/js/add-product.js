import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

/**
 * Verifica si el usuario actual es un administrador.
 * Redirige si no es admin.
 * @returns {boolean} true si el usuario es admin, false en caso contrario.
 */
async function checkAdminStatus() {
    if (!supabase) return false;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = '/login.html?redirect=/add-product.html';
        return false;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

    if (profile?.rol !== 'admin') {
        showToast('Acceso denegado. Solo administradores.', 'error');
        window.location.href = '/';
        return false;
    }
    return true;
}

/**
 * Popula los <select> del formulario con categorías, marcas y tallas.
 */
async function populateFormSelects() {
    const categorySelect = document.querySelector('select[name="id_categoria"]');
    const brandSelect = document.querySelector('select[name="id_marca"]');
    const tallaSelect = document.querySelector('select[name="id_talla"]');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No hay sesión activa para cargar los datos del formulario.');
        }

        // **LA CORRECCIÓN CLAVE ESTÁ AQUÍ**
        // Añadimos el token de autorización a las peticiones
        const fetchOptions = {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        };

        const [catRes, brandRes, tallaRes] = await Promise.all([
            fetch('/api/categorias', fetchOptions),
            fetch('/api/marcas', fetchOptions),
            fetch('/api/tallas', fetchOptions)
        ]);

        const categories = await catRes.json();
        const brands = await brandRes.json();
        const tallas = await tallaRes.json();

        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
            categories.forEach(cat => categorySelect.innerHTML += `<option value="${cat.id_categoria}">${cat.nombre}</option>`);
        }
        if (brandSelect) {
            brandSelect.innerHTML = '<option value="">Selecciona una marca</option>';
            brands.forEach(brand => brandSelect.innerHTML += `<option value="${brand.id_marca}">${brand.nombre}</option>`);
        }
        if (tallaSelect) {
            tallaSelect.innerHTML = '<option value="">Selecciona una talla</option>';
            tallas.forEach(talla => tallaSelect.innerHTML += `<option value="${talla.id_talla}">${talla.tipo} - ${talla.valor}</option>`);
        }

    } catch (error) {
        console.error("Error al cargar selectores del formulario:", error);
        showToast('Error cargando datos para el formulario.', 'error');
    }
}

/**
 * Maneja el envío del formulario para añadir un nuevo producto.
 * (Esta función ya estaba en admin.js, la adaptamos aquí)
 */
function handleAddProductForm() {
    const form = document.getElementById('add-product-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Añadiendo...';

        const formData = new FormData(form);
        const productData = Object.fromEntries(formData.entries());

        // Convertir a números y manejar valores nulos
        productData.precio = Number(productData.precio) || 0;
        productData.stock = Number(productData.stock) || 0;
        productData.id_categoria = Number(productData.id_categoria) || null;
        productData.id_marca = Number(productData.id_marca) || null;
        productData.id_talla = Number(productData.id_talla) || null;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(productData)
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Error en el servidor');

            showToast('Producto añadido con éxito', 'success');
            form.reset(); // Limpiar el formulario
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Añadir Producto';
        }
    });
}

/**
 * Función de inicialización para la página de añadir producto.
 */
async function initAddProductPage() {
    supabase = await getSupabaseClient();
    if (!supabase) {
        showToast('Error al conectar con la base de datos.', 'error');
        return;
    }

    const isAdmin = await checkAdminStatus();
    if (isAdmin) {
        // Si es admin, cargar los selectores del formulario
        populateFormSelects();
        handleAddProductForm(); // Y preparar el formulario para ser enviado
    }
}

document.addEventListener('DOMContentLoaded', initAddProductPage);