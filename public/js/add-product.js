import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;
let isEditMode = false;
let productIdToEdit = null;
let productVariations = []; // Array para almacenar temporalmente las variaciones {id_talla, stock, nombreTalla}

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
    // El select de talla ahora está dentro de la sección de variaciones, no es global
    const variationSizeSelect = document.getElementById('variation-size-select');
    
    if (variationSizeSelect) {
        variationSizeSelect.disabled = true;
        variationSizeSelect.innerHTML = '<option value="">Selecciona una categoría arriba</option>';
    }
    
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

        const [catRes, brandRes] = await Promise.all([
            fetch('/api/categorias', fetchOptions),
            fetch('/api/marcas', fetchOptions)
        ]);

        const categories = await catRes.json();
        const brands = await brandRes.json();

        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
            categories.forEach(cat => categorySelect.innerHTML += `<option value="${cat.id_categoria}">${cat.nombre}</option>`);

            // Añadir listener para cargar tallas cuando cambia la categoría
            categorySelect.addEventListener('change', async (e) => {
                const categoryId = e.target.value;
                if (variationSizeSelect) {
                    variationSizeSelect.disabled = true;
                    variationSizeSelect.innerHTML = '<option value="">Cargando tallas...</option>';
                }

                if (!categoryId) {
                    if (variationSizeSelect) variationSizeSelect.innerHTML = '<option value="">Selecciona una categoría arriba</option>';
                    return;
                }

                try {
                    const tallasRes = await fetch(`/api/tallas?id_categoria=${categoryId}`, fetchOptions);
                    const tallas = await tallasRes.json();
                    
                    if (variationSizeSelect) {
                        variationSizeSelect.innerHTML = '<option value="">Selecciona una talla</option>';
                        if (tallas.length > 0) {
                            tallas.forEach(talla => variationSizeSelect.innerHTML += `<option value="${talla.id_talla}">${talla.valor}</option>`);
                            variationSizeSelect.disabled = false;
                        } else {
                            variationSizeSelect.innerHTML = '<option value="">No hay tallas para esta categoría</option>';
                        }
                    }
                } catch (error) {
                    console.error('Error al cargar tallas:', error);
                    if (variationSizeSelect) variationSizeSelect.innerHTML = '<option value="">Error al cargar tallas</option>';
                }
            });
        }
        if (brandSelect) {
            brandSelect.innerHTML = '<option value="">Selecciona una marca</option>';
            brands.forEach(brand => brandSelect.innerHTML += `<option value="${brand.id_marca}">${brand.nombre}</option>`);
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
        // La consulta debe traer la información anidada de tallas y categorías
        const response = await fetch(`/api/products/${id}`);
        if (!response.ok) throw new Error('No se pudo cargar el producto');
        const product = await response.json();

        // Cambiar el título y el botón visualmente
        const title = document.querySelector('h1, h2, h3');
        if (title && title.textContent.includes('Añadir')) {
            title.textContent = 'Editar Producto';
        }
        
        const form = document.getElementById('add-product-form');
        const categorySelect = form.querySelector('[name="id_categoria"]');
        const variationSizeSelect = document.getElementById('variation-size-select');

        if (form) {
            form.querySelector('[name="nombre"]').value = product.nombre;
            form.querySelector('[name="precio"]').value = product.precio;
            form.querySelector('[name="imagen_url"]').value = product.imagen_url;
            form.querySelector('[name="descripcion"]').value = product.descripcion || '';
            
            // Asignar marca
            if (product.id_marca) form.querySelector('[name="id_marca"]').value = product.id_marca;

            // Cargar variaciones existentes
            if (product.producto_variaciones && product.producto_variaciones.length > 0) {
                // Determinar categoría basada en la primera variación
                const firstVar = product.producto_variaciones[0];
                if (firstVar.tallas && firstVar.tallas.categorias) {
                    categorySelect.value = firstVar.tallas.categorias.id_categoria;
                    
                    // Disparar evento change manualmente para cargar las tallas en el select
                    categorySelect.dispatchEvent(new Event('change'));
                }

                // Llenar array de variaciones
                productVariations = product.producto_variaciones.map(v => ({
                    id_talla: v.tallas.id_talla,
                    stock: v.stock,
                    nombreTalla: v.tallas.valor
                }));
                renderVariationsList();
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
        }
    } catch (error) {
        console.error(error);
        showToast('Error al cargar los datos del producto.', 'error');
    }
}

/**
 * Renderiza la lista visual de variaciones añadidas.
 */
function renderVariationsList() {
    const container = document.getElementById('variations-list');
    if (!container) return;

    container.innerHTML = '';
    
    if (productVariations.length === 0) {
        container.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #888; padding: 1rem;">No hay variaciones añadidas.</td></tr>';
        return;
    }

    productVariations.forEach((v, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${v.nombreTalla}</strong></td>
            <td>${v.stock}</td>
            <td><button type="button" class="btn btn-sm btn-delete-var" data-index="${index}" style="background: transparent; color: #dc3545; border: 1px solid #dc3545; padding: 0.2rem 0.5rem; cursor: pointer;">Eliminar</button></td>
        `;
        container.appendChild(tr);
    });

    // Listeners para eliminar
    container.querySelectorAll('.btn-delete-var').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            productVariations.splice(idx, 1);
            renderVariationsList();
        });
    });
}

/**
 * Configura el botón para añadir una variación a la lista temporal.
 */
function setupAddVariationButton() {
    const addVarBtn = document.getElementById('add-variation-btn');
    if (!addVarBtn) return;

    addVarBtn.addEventListener('click', () => {
        const sizeSelect = document.getElementById('variation-size-select');
        const stockInput = document.getElementById('variation-stock-input');

        if (!sizeSelect.value || !stockInput.value) {
            showToast('Selecciona una talla e ingresa el stock.', 'error');
            return;
        }

        const id_talla = parseInt(sizeSelect.value);
        const stock = parseInt(stockInput.value);
        const nombreTalla = sizeSelect.options[sizeSelect.selectedIndex].text;

        // Verificar si ya existe
        const exists = productVariations.find(v => v.id_talla === id_talla);
        if (exists) {
            exists.stock = stock; // Actualizar stock si ya existe
            showToast('Stock actualizado para esta talla.', 'success');
        } else {
            productVariations.push({ id_talla, stock, nombreTalla });
        }

        renderVariationsList();
        stockInput.value = ''; // Limpiar input de stock
    });
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
        const precioNum = Number(productData.precio);
        if (isNaN(precioNum)) {
            showToast('Error: El precio debe ser un número válido.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Guardar Cambios' : 'Añadir Producto';
            return;
        }
        productData.precio = precioNum;

        delete productData.id_categoria; // Eliminar la categoría del objeto, ya no se guarda en productos
        productData.id_marca = Number(productData.id_marca) || null;
        productData.variaciones = productVariations; // Añadir el array de variaciones

        if (productVariations.length === 0) {
            showToast('Error: Debes añadir al menos una variación (talla y stock).', 'error');
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Guardar Cambios' : 'Añadir Producto';
            return;
        }

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
                productVariations = [];
                renderVariationsList();
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

        setupAddVariationButton();
        handleFormSubmit(); // Y preparar el formulario para ser enviado
    }
}

document.addEventListener('DOMContentLoaded', initAddProductPage);