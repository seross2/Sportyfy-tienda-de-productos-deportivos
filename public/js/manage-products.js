import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

/**
 * Carga y muestra los productos en una tabla en el panel de administración.
 */
async function loadProducts() {
    const container = document.getElementById('products-list-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando todos los productos...</p>';
    try {
        const productsPerPage = 12; // Límite de productos por página que usa el API.
        let allProducts = [];

        // 1. Hacemos una primera llamada para obtener el total de productos y la primera página.
        const firstPageResponse = await fetch(`/api/products?page=1&limit=${productsPerPage}&t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!firstPageResponse.ok) throw new Error('No se pudo cargar la primera página de productos.');
        
        const { products: firstPageProducts, totalCount } = await firstPageResponse.json();
        allProducts = allProducts.concat(firstPageProducts);

        const totalPages = Math.ceil(totalCount / productsPerPage);

        // 2. Si hay más páginas, las pedimos todas en paralelo.
        if (totalPages > 1) {
            const pagePromises = [];
            for (let page = 2; page <= totalPages; page++) {
                pagePromises.push(
                    fetch(`/api/products?page=${page}&limit=${productsPerPage}&t=${Date.now()}`, {
                        headers: { 'Cache-Control': 'no-cache' }
                    }).then(res => {
                        if (!res.ok) {
                            console.error(`Error al cargar la página ${page}`);
                            return { products: [] }; // Devolver vacío para no romper Promise.all
                        }
                        return res.json();
                    })
                );
            }

            const remainingPagesResults = await Promise.all(pagePromises);
            
            remainingPagesResults.forEach(result => {
                if (result.products) {
                    allProducts = allProducts.concat(result.products);
                }
            });
        }

        // 3. Ordenamos la lista completa por ID para un orden consistente.
        allProducts.sort((a, b) => a.id_producto - b.id_producto);

        if (!allProducts || allProducts.length === 0) {
            container.innerHTML = '<p>No hay productos registrados.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'admin-table'; // Usamos la clase de estilo consistente
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Categoría</th>
                    <th>Marca</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${allProducts.map(product => `
                    <tr data-id="${product.id_producto}">
                        <td>${product.id_producto}</td>
                        <td>${product.nombre}</td>
                        <td>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.precio)}</td>
                        <td>${product.stock}</td>
                        <td>${product.category_name || 'N/A'}</td>
                        <td>${product.marcas?.nombre || 'N/A'}</td>
                        <td>
                            <button class="btn btn-edit" data-id="${product.id_producto}">Editar</button>
                            <button class="btn btn-delete" data-id="${product.id_producto}">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

        // Añadir listeners para los botones de editar y eliminar
        container.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', handleEdit);
        });
        container.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', handleDelete);
        });

    } catch (error) {
        container.innerHTML = `<p>Error al cargar la lista completa de productos: ${error.message}</p>`;
        console.error(error);
    }
}

/**
 * Maneja el evento de clic en el botón "Editar".
 * Redirige al formulario de edición con el ID del producto.
 */
function handleEdit(event) {
    const id = event.target.dataset.id;
    // Redirigimos a la página de añadir/editar, pasando el ID como parámetro
    // NOTA: Esta página aún no la hemos creado, pero preparamos la lógica.
    window.location.href = `/add-product.html?edit=${id}`;
}

/**
 * Maneja el evento de clic en el botón "Eliminar".
 * Pide confirmación y elimina el producto.
 */
async function handleDelete(event) {
    const id = event.target.dataset.id;
    if (!confirm(`¿Estás seguro de que quieres eliminar el producto con ID ${id}?`)) {
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo eliminar el producto.');
        }

        showToast('Producto eliminado con éxito.', 'success');
        // Eliminar la fila de la tabla visualmente
        document.querySelector(`tr[data-id="${id}"]`).remove();
        // Recargar los contadores del dashboard
        document.dispatchEvent(new CustomEvent('productDeleted'));

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Inicializa la página, obtiene el cliente de Supabase y carga los productos.
 */
export async function init() {
    supabase = await getSupabaseClient();
    if (!document.getElementById('products-list-container')) return; // No ejecutar si no estamos en la página de admin
    
    loadProducts();

    // Escuchar eventos para recargar la lista de productos
    // (Aunque handleDelete ya recarga, mantenemos esto por consistencia si se añade desde otro lado)
    document.addEventListener('productAdded', loadProducts);
    document.addEventListener('productDeleted', loadProducts);

    // SOLUCIÓN: Forzar la recarga de productos cuando se vuelve a la página.
    // Esto soluciona el problema de que el navegador muestre una lista "vieja" (en caché)
    // después de editar un producto y volver atrás.
    window.addEventListener('pageshow', function(event) {
        // event.persisted es true si la página se carga desde la caché del navegador (bfcache)
        if (event.persisted) {
            console.log('Página cargada desde caché, recargando productos...');
            loadProducts();
        }
    });
}

// document.addEventListener('DOMContentLoaded', init); // Lo llamará admin.js
