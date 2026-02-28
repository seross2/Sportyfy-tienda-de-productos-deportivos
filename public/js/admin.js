import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';
import { init as initProducts } from '/js/manage-products.js';
import { init as initCategories } from '/js/manage-categories.js';
import { init as initBrands } from '/js/manage-brands.js';
import { init as initSizes } from '/js/manage-sizes.js';
import '/js/global.js'; // Asegura que el menú se cargue en el panel de admin

let supabase;

async function checkAdminStatus() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile) return false;

    const userRole = profile.rol;
    return userRole === 'admin';
}

function renderAdminLayout() {
    const wrapper = document.getElementById('admin-access-wrapper');
    wrapper.innerHTML = `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <div class="admin-sidebar-header">
                    <h2>Admin Panel</h2>
                </div>
                <ul class="admin-nav">
                    <li><button class="admin-nav-btn active" data-target="dashboard-section">
                        <span>📊</span> Dashboard
                    </button></li>
                    <li><button class="admin-nav-btn" data-target="products-section">
                        <span>📦</span> Productos
                    </button></li>
                    <li><button class="admin-nav-btn" data-target="orders-section">
                        <span>📝</span> Pedidos
                    </button></li>
                    <li><button class="admin-nav-btn" data-target="categories-section">
                        <span>🗂️</span> Categorías
                    </button></li>
                    <li><button class="admin-nav-btn" data-target="brands-section">
                        <span>®️</span> Marcas
                    </button></li>
                    <li><button class="admin-nav-btn" data-target="sizes-section">
                        <span>📏</span> Tallas
                    </button></li>
                </ul>
            </aside>
            <div class="admin-content">
                <!-- Dashboard Section -->
                <section id="dashboard-section" class="admin-section active">
                    <h2>Dashboard</h2>
                    <div class="dashboard-cards">
                        <div class="dashboard-card">
                            <h4>Total Productos</h4>
                            <p id="total-products">Cargando...</p>
                        </div>
                        <div class="dashboard-card">
                            <h4>Pedidos Pendientes</h4>
                            <p>Cargando...</p>
                        </div>
                        <div class="dashboard-card">
                            <h4>Ingresos (Mes)</h4>
                            <p>Cargando...</p>
                        </div>
                    </div>
                </section>

                <!-- Products Section -->
                <section id="products-section" class="admin-section">
                    <div class="admin-section-header">
                        <h2>Gestionar Productos</h2>
                        <button id="toggle-add-product-form" class="btn btn-primary">Añadir Nuevo Producto</button>
                    </div>
                    <div id="add-product-container" class="card hidden">
                        <h3>Añadir Nuevo Producto</h3>
                        <form id="add-product-form">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="nombre">Nombre del Producto</label>
                                    <input type="text" name="nombre" required>
                                </div>
                                <div class="form-group">
                                    <label for="precio">Precio (en centavos, ej: 50000 para $500)</label>
                                    <input type="number" name="precio" required>
                                </div>
                                <div class="form-group">
                                    <label for="stock">Stock</label>
                                    <input type="number" name="stock" required>
                                </div>
                                <div class="form-group">
                                    <label for="id_categoria">Categoría</label>
                                    <select name="id_categoria"></select>
                                </div>
                                <div class="form-group">
                                    <label for="id_marca">Marca</label>
                                    <select name="id_marca"></select>
                                </div>
                                <div class="form-group">
                                    <label for="id_talla">Talla</label>
                                    <select name="id_talla"></select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="imagen_url">URL de la Imagen</label>
                                <input type="url" name="imagen_url" required>
                            </div>
                            <div class="form-group">
                                <label for="descripcion">Descripción</label>
                                <textarea name="descripcion" rows="3"></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">Añadir Producto</button>
                        </form>
                    </div>
                    <div class="table-container card">
                        <h3>Productos Existentes</h3>
                        <div id="products-list-container"></div>
                    </div>
                </section>

                <!-- Orders Section -->
                <section id="orders-section" class="admin-section">
                    <h2>Historial de Pedidos</h2>
                    <div class="card">
                        <p>Próximamente podrás ver y gestionar todos los pedidos de la tienda aquí.</p>
                    </div>
                </section>

                <!-- Categories Section -->
                <section id="categories-section" class="admin-section">
                    <div class="admin-section-header">
                        <h2>Gestionar Categorías</h2>
                        <button id="toggle-add-category-form" class="btn btn-primary">Añadir Nueva Categoría</button>
                    </div>
                    <div id="add-category-container" class="card hidden">
                        <h3>Añadir Nueva Categoría</h3>
                        <form id="add-category-form" class="form-inline">
                            <div class="form-group">
                                <label for="category-name">Nombre</label>
                                <input type="text" id="category-name" name="nombre" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Añadir Categoría</button>
                        </form>
                    </div>
                    <div class="table-container card">
                        <h3>Categorías Existentes</h3>
                        <div id="categories-list-container"></div>
                    </div>
                </section>

                <!-- Brands Section -->
                <section id="brands-section" class="admin-section">
                    <div class="admin-section-header">
                        <h2>Gestionar Marcas</h2>
                        <button id="toggle-add-brand-form" class="btn btn-primary">Añadir Nueva Marca</button>
                    </div>
                    <div id="add-brand-container" class="card hidden">
                        <h3>Añadir Nueva Marca</h3>
                        <form id="add-brand-form" class="form-inline">
                            <div class="form-group">
                                <label for="brand-name">Nombre</label>
                                <input type="text" id="brand-name" name="nombre" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Añadir Marca</button>
                        </form>
                    </div>
                    <div class="table-container card">
                        <h3>Marcas Existentes</h3>
                        <div id="brands-list-container"></div>
                    </div>
                </section>

                <!-- Sizes Section -->
                <section id="sizes-section" class="admin-section">
                    <div class="admin-section-header">
                        <h2>Gestionar Tallas</h2>
                        <button id="toggle-add-size-form" class="btn btn-primary">Añadir Nueva Talla</button>
                    </div>
                    <div id="add-size-container" class="card hidden">
                        <h3>Añadir Nueva Talla</h3>
                        <form id="add-size-form" class="form-inline">
                            <div class="form-group">
                                <label for="size-type">Tipo (ej: Calzado, Ropa)</label>
                                <input type="text" id="size-type" name="tipo" required>
                            </div>
                            <div class="form-group">
                                <label for="size-value">Valor (ej: 42, M, L)</label>
                                <input type="text" id="size-value" name="valor" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Añadir Talla</button>
                        </form>
                    </div>
                    <div class="table-container card">
                        <h3>Tallas Existentes</h3>
                        <div id="sizes-list-container"></div>
                    </div>
                </section>
            </div>
        </div>
    `;
    addAdminNavListeners();
    setupFormToggles();
}

/**
 * Carga los datos para las tarjetas del dashboard (ej. total de productos).
 */
async function loadDashboardData() {
    const totalProductsEl = document.getElementById('total-products');    
    if (totalProductsEl) {
        try {
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
}

function addAdminNavListeners() {
    const navButtons = document.querySelectorAll('.admin-nav-btn');
    const sections = document.querySelectorAll('.admin-section');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            
            button.classList.add('active');
            const targetId = button.dataset.target;
            document.getElementById(targetId).classList.add('active');
        });
    });
}

/**
 * Configura los listeners para los botones que muestran/ocultan los formularios de "Añadir".
 */
function setupFormToggles() {
    const toggles = [
        { btnId: 'toggle-add-product-form', containerId: 'add-product-container', text: 'Producto' },
        { btnId: 'toggle-add-category-form', containerId: 'add-category-container', text: 'Categoría' },
        { btnId: 'toggle-add-brand-form', containerId: 'add-brand-container', text: 'Marca' },
        { btnId: 'toggle-add-size-form', containerId: 'add-size-container', text: 'Talla' }
    ];

    toggles.forEach(({ btnId, containerId, text }) => {
        const toggleBtn = document.getElementById(btnId);
        const formContainer = document.getElementById(containerId);
        if (toggleBtn && formContainer) {
            toggleBtn.addEventListener('click', () => {
                formContainer.classList.toggle('hidden');
                const isVisible = !formContainer.classList.contains('hidden');
                toggleBtn.textContent = isVisible ? `Añadir Nuev${text === 'Producto' ? 'o' : 'a'} ${text}` : 'Ocultar Formulario';
            });
        }
    });
}

/**
 * Popula los <select> del formulario con categorías y marcas.
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
            // Mostramos las tallas combinando el tipo y el valor (ej. "Calzado - 42")
            tallas.forEach(talla => tallaSelect.innerHTML += `<option value="${talla.id_talla}">${talla.tipo} - ${talla.valor}</option>`);
        }

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
            form.reset();
            loadDashboardData(); // Recargar datos del dashboard para ver el nuevo total
            document.dispatchEvent(new CustomEvent('productAdded')); // Disparar evento para recargar la tabla de productos
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
        const wrapper = document.getElementById('admin-access-wrapper');
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="access-denied-container">
                    <h2>Acceso Restringido</h2>
                    <p>Debes iniciar sesión con una cuenta de administrador para ver este contenido.</p>
                    <a href="/login.html?redirect=/admin.html" class="btn btn-primary">Iniciar Sesión</a>
                </div>
            `;
        }
        return;
    }

    // Si es admin, renderizar el layout y cargar todo lo demás.
    renderAdminLayout();
    loadDashboardData();
    populateFormSelects();
    handleAddProductForm();

    // Escuchar evento para recargar el contador de productos del dashboard
    document.addEventListener('productDeleted', loadDashboardData);

    // Ahora que el layout está renderizado, inicializamos los módulos que cargan las tablas.
    initProducts();
    initCategories();
    initBrands();
    initSizes();
}

document.addEventListener('DOMContentLoaded', initAdminPage);