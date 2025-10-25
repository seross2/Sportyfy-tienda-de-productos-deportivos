import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

/**
 * Verifica si el usuario actual es un administrador.
 * No redirige si no hay sesión, solo devuelve false.
 * Redirige a la página principal si está logueado pero no es admin.
 * @returns {boolean} true si el usuario es admin, false en caso contrario.
 */
async function checkAdminStatus() {
    if (!supabase) {
        console.error("Supabase no inicializado en admin.js");
        return false;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        // No hay sesión, no es admin. Permitir que la página cargue pero sin funcionalidades.
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile || profile.rol !== 'admin') {
        // Logueado pero no es admin, redirigir a la página principal.
        showToast('Acceso denegado. No tienes permisos de administrador.', 'error');
        window.location.href = '/';
        return false; // Este return no se alcanzará debido a la redirección
    }
    // Si todo está bien, el usuario es admin y puede quedarse en la página.
    console.log('Acceso de administrador verificado.');
    return true;
}

/**
 * Carga los datos para las tarjetas del dashboard (ej. total de productos).
 */
async function loadDashboardData() {
    const totalProductsEl = document.getElementById('total-products');
    // Puedes añadir más elementos aquí, como 'pending-orders', 'monthly-revenue'

    if (totalProductsEl) {
        try {
            // Usamos rpc para contar, es más eficiente que traer todos los productos.
            const { data, error, count } = await supabase
                .from('productos')
                .select('*', { count: 'exact', head: true }); // head:true para no traer datos, solo el conteo

            if (error) throw error;

            totalProductsEl.textContent = count;
        } catch (error) {
            console.error('Error cargando datos del dashboard:', error);
            totalProductsEl.textContent = 'Error';
        }
    }
    // Aquí podrías hacer más llamadas para las otras tarjetas
}

/**
 * Popula los <select> del formulario con categorías y marcas.
 */
async function populateFormSelects() {
    const categorySelect = document.getElementById('id_categoria');
    const brandSelect = document.getElementById('id_marca');

    if (!categorySelect || !brandSelect) return;

    try {
        const [catRes, brandRes] = await Promise.all([
            fetch('/api/categorias'),
            fetch('/api/marcas')
        ]);
        const categories = await catRes.json();
        const brands = await brandRes.json();

        categories.forEach(cat => categorySelect.innerHTML += `<option value="${cat.id_categoria}">${cat.nombre}</option>`);
        brands.forEach(brand => brandSelect.innerHTML += `<option value="${brand.id_marca}">${brand.nombre}</option>`);

    } catch (error) {
        console.error("Error al cargar selectores del formulario:", error);
    }
}

/**
 * Maneja el envío del formulario para añadir un nuevo producto.
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

        // El precio se envía en centavos
        productData.precio = Number(productData.precio);

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
            form.reset();
            loadDashboardData(); // Recargar datos del dashboard para ver el nuevo total
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Añadir Producto';
        }
    });
}

/**
 * Función de inicialización para la página de administración.
 */
async function initAdminPage() {
    supabase = await getSupabaseClient();
    const isAdmin = await checkAdminStatus();

    if (!isAdmin) {
        // Si no es admin (incluyendo no logueado), ocultar/deshabilitar funcionalidades
        const dashboardSection = document.getElementById('dashboard');
        const addProductFormSection = document.getElementById('add-product-form-section');
        const container = document.querySelector('.admin-main .container');

        if (dashboardSection) dashboardSection.remove();
        if (addProductFormSection) addProductFormSection.remove();

        if (container) {
            container.innerHTML = `
                <div class="admin-access-message-wrapper">
                    <h2 class="admin-section-title">Acceso Restringido</h2>
                    <p>Para acceder al panel de administración, debes iniciar sesión con una cuenta de administrador.</p>
                    <a href="/login.html?redirect=/admin.html" class="btn btn-primary">Iniciar Sesión</a>
                </div>
            `;
        }
        return; // Detener la inicialización de funcionalidades de admin
    }

    // Si es admin, cargar datos y formularios
    loadDashboardData();
    populateFormSelects();
    handleAddProductForm();
}

document.addEventListener('DOMContentLoaded', initAdminPage);