import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
let isEditMode = false;
let productIdToEdit = null;

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
 * Carga los datos de un producto existente para editarlo.
 */
async function loadProductData(id) {
    try {
        const response = await fetch(`/api/products/${id}`);
        if (!response.ok) throw new Error('No se pudo cargar el producto');
        const product = await response.json();

        // Cambiar el título y el botón visualmente
        const title = document.querySelector('h1, h2, h3');
        if (title && title.textContent.includes('Añadir')) {
            title.textContent = 'Editar Producto';
        }
        
        const form = document.getElementById('add-product-form');
        if (form) {
            form.querySelector('[name="nombre"]').value = product.nombre;
            form.querySelector('[name="precio"]').value = product.precio;
            form.querySelector('[name="stock"]').value = product.stock;
            form.querySelector('[name="imagen_url"]').value = product.imagen_url;
            form.querySelector('[name="descripcion"]').value = product.descripcion || '';
            
            // Asignar valores a los selects (asegurándose de que coincidan con los IDs)
            if (product.id_categoria) form.querySelector('[name="id_categoria"]').value = product.id_categoria;
            if (product.id_marca) form.querySelector('[name="id_marca"]').value = product.id_marca;
            if (product.id_talla) form.querySelector('[name="id_talla"]').value = product.id_talla;

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
        }
    } catch (error) {
        console.error(error);
        showToast('Error al cargar los datos del producto.', 'error');
    }
}

/**
 * Maneja el envío del formulario para añadir un nuevo producto.
 * (Esta función ya estaba en admin.js, la adaptamos aquí)
 */
function handleFormSubmit() {
    const form = document.getElementById('add-product-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = isEditMode ? 'Guardando...' : 'Añadiendo...';

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
            
            const url = isEditMode ? `/api/products/${productIdToEdit}` : '/api/products';
            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(productData)
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Error en el servidor');

            showToast(isEditMode ? 'Producto actualizado con éxito' : 'Producto añadido con éxito', 'success');
            
            if (!isEditMode) {
                form.reset(); // Limpiar el formulario solo si estamos añadiendo
            } else {
                // Redirigir al admin después de editar para ver los cambios
                setTimeout(() => window.location.href = '/admin.html', 1500);
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Guardar Cambios' : 'Añadir Producto';
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
        await populateFormSelects();
        
        // Verificar si hay un ID en la URL para modo edición
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        if (editId) {
            isEditMode = true;
            productIdToEdit = editId;
            await loadProductData(editId);
        }

        handleFormSubmit(); // Y preparar el formulario para ser enviado
    }
}

document.addEventListener('DOMContentLoaded', initAddProductPage);