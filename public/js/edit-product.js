import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

let supabase;

async function populateEditForm() {
    const form = document.getElementById('edit-product-form');
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        form.innerHTML = '<p>No se especificó un ID de producto.</p>';
        return;
    }

    try {
        // Obtener datos del producto y de los selects en paralelo
        const [productRes, catRes, brandRes, tallaRes] = await Promise.all([
            fetch(`/api/products/${productId}`),
            fetch('/api/categorias'),
            fetch('/api/marcas'),
            fetch('/api/tallas')
        ]);

        if (!productRes.ok) throw new Error('Producto no encontrado');

        const product = await productRes.json();
        const categories = await catRes.json();
        const brands = await brandRes.json();
        const tallas = await tallaRes.json();

        form.innerHTML = `
            <input type="hidden" name="id_producto" value="${product.id_producto}">
            <label for="nombre">Nombre:</label>
            <input type="text" name="nombre" value="${product.nombre}" required>
            
            <label for="descripcion">Descripción:</label>
            <textarea name="descripcion">${product.descripcion || ''}</textarea>
            
            <label for="precio">Precio (COP):</label>
            <input type="number" name="precio" value="${product.precio}" required>
            
            <label for="stock">Stock:</label>
            <input type="number" name="stock" value="${product.stock}" required>
            
            <label for="imagen_url">URL de Imagen:</label>
            <input type="text" name="imagen_url" value="${product.imagen_url}" required>
            
            <label for="id_categoria">Categoría:</label>
            <select name="id_categoria" required>
                ${categories.map(c => `<option value="${c.id_categoria}" ${c.id_categoria === product.id_categoria ? 'selected' : ''}>${c.nombre}</option>`).join('')}
            </select>
            
            <label for="id_marca">Marca:</label>
            <select name="id_marca" required>
                ${brands.map(b => `<option value="${b.id_marca}" ${b.id_marca === product.id_marca ? 'selected' : ''}>${b.nombre}</option>`).join('')}
            </select>

            <label for="id_talla">Talla:</label>
            <select name="id_talla" required>
                ${tallas.map(t => `<option value="${t.id_talla}" ${t.id_talla === product.id_talla ? 'selected' : ''}>${t.tipo} - ${t.valor}</option>`).join('')}
            </select>
            
            <button type="submit">Guardar Cambios</button>
        `;

        form.addEventListener('submit', handleUpdateProduct);

    } catch (error) {
        form.innerHTML = `<p>Error al cargar el producto: ${error.message}</p>`;
    }
}

async function handleUpdateProduct(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';

    const formData = new FormData(form);
    const productData = Object.fromEntries(formData.entries());
    const productId = productData.id_producto;

    // Convertir a números
    productData.precio = Number(productData.precio);
    productData.stock = Number(productData.stock);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no válida.');

        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en el servidor.');
        }

        showToast('Producto actualizado con éxito.', 'success');
        setTimeout(() => window.location.href = '/admin.html', 1500);

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar Cambios';
    }
}

async function initEditPage() {
    supabase = await getSupabaseClient();
    populateEditForm();
}

document.addEventListener('DOMContentLoaded', initEditPage);