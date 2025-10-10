// Este código se ejecuta en el navegador del cliente
import { addProductToCart } from '/cart-logic.js';
import { getSupabaseClient } from '/supabaseClient.js';
import { showToast } from '/utils.js';

const productGrid = document.querySelector('.product-grid');
let allProducts = []; // Variable para almacenar los productos una vez cargados

// Elementos de filtro
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const brandFilter = document.getElementById('brand-filter');
const resetFiltersButton = document.getElementById('reset-filters');

// 1. Cargar y mostrar los productos desde la API
async function fetchProducts() {
  if (!productGrid) return; // No hacer nada si el contenedor no existe

  try {
    productGrid.innerHTML = '<p>Cargando productos...</p>';
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error('La respuesta de la red no fue correcta');
    }
    const products = await response.json(); 
    allProducts = products; // Guardar los productos en la variable global

    productGrid.innerHTML = ''; // Limpiar el mensaje de "cargando"
    renderProducts(products);
    // Usaremos delegación de eventos en lugar de esta función
  } catch (error) {
    productGrid.innerHTML = '<p>No se pudieron cargar los productos. Inténtalo de nuevo más tarde.</p>';
    console.error('Error fetching products:', error);
  }
}

function renderProducts(products) {
    productGrid.innerHTML = '';
    if (products.length === 0) {
        productGrid.innerHTML = '<p>No se encontraron productos que coincidan con tu búsqueda.</p>';
        return;
    }

    products.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'product-item';
        productItem.innerHTML = `
            <img src="${product.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${product.nombre}">
            <h3>${product.nombre}</h3>
            <p>${product.descripcion}</p>
            <span class="price">$${(product.precio / 100).toFixed(2)}</span>
            <button class="btn add-to-cart-btn" data-product-id="${product.id_producto}">Añadir al Carrito</button>
            <!-- Sección de Reseñas (se mantiene igual) -->
            <div class="reviews-section" id="reviews-for-${product.id_producto}">
                <h4>Reseñas</h4>
                <div class="reviews-list">Cargando reseñas...</div>
                <form class="review-form" data-product-id="${product.id_producto}" style="display: none;">
                    <h5>Deja tu reseña</h5>
                    <div class="star-rating">
                        <input type="radio" id="star5-${product.id_producto}" name="rating" value="5" /><label for="star5-${product.id_producto}">&#9733;</label>
                        <input type="radio" id="star4-${product.id_producto}" name="rating" value="4" /><label for="star4-${product.id_producto}">&#9733;</label>
                        <input type="radio" id="star3-${product.id_producto}" name="rating" value="3" /><label for="star3-${product.id_producto}">&#9733;</label>
                        <input type="radio" id="star2-${product.id_producto}" name="rating" value="2" /><label for="star2-${product.id_producto}">&#9733;</label>
                        <input type="radio" id="star1-${product.id_producto}" name="rating" value="1" /><label for="star1-${product.id_producto}">&#9733;</label>
                    </div>
                    <textarea name="comment" placeholder="Escribe tu comentario aquí..." required></textarea>
                    <button type="submit">Enviar Reseña</button>
                </form>
            </div>
        `;
        productGrid.appendChild(productItem);
    });

    // Recargar reseñas para los productos visibles
    products.forEach(p => loadReviewsForProduct(p.id_producto));
}

async function loadReviewsForProduct(productId) {
    const reviewsList = document.querySelector(`#reviews-for-${productId} .reviews-list`);
    if (!reviewsList) return;

    try {
        const response = await fetch(`/api/reviews/${productId}`);
        const reviews = await response.json();

        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p>Aún no hay reseñas para este producto.</p>';
            return;
        }

        reviewsList.innerHTML = reviews.map(review => `
            <div class="review-item">
                <strong>${review.profiles.username || 'Anónimo'}</strong>
                <span class="review-stars">${'&#9733;'.repeat(review.puntuacion)}${'&#9734;'.repeat(5 - review.puntuacion)}</span>
                <p>${review.comentario}</p>
            </div>
        `).join('');
    } catch (error) {
        reviewsList.innerHTML = '<p>Error al cargar reseñas.</p>';
        console.error(`Error fetching reviews for product ${productId}:`, error);
    }
}

async function handleReviewFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const productId = form.dataset.productId;
    const submitButton = form.querySelector('button[type="submit"]');

    const supabase = await getSupabaseClient();
    if (!supabase) return showToast('Error de configuración.', 'error');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        showToast('Debes iniciar sesión para dejar una reseña.', 'error');
        return;
    }

    submitButton.disabled = true;
    const formData = new FormData(form);
    const reviewData = {
        id_producto: parseInt(productId, 10),
        puntuacion: parseInt(formData.get('rating'), 10),
        comentario: formData.get('comment')
    };

    try {
        const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(reviewData)
        });

        if (!response.ok) {
            // Leer el mensaje de error específico del backend
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo enviar la reseña.');
        }

        showToast('¡Gracias por tu reseña!', 'success');
        form.reset();
        loadReviewsForProduct(productId); // Recargar reseñas para ver la nueva
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

// 2. Usar delegación de eventos para manejar los clics en los botones
if (productGrid) {
  productGrid.addEventListener('click', async (event) => {
    if (event.target.matches('.add-to-cart-btn')) {
      const productId = event.target.dataset.productId; 
      const productToAdd = allProducts.find(p => p.id_producto === Number(productId));
      if (productToAdd) {
        addProductToCart(productToAdd);
        showToast(`"${productToAdd.nombre}" ha sido añadido al carrito.`);
      }
    }
  });

  // Delegación para los formularios de reseña
  productGrid.addEventListener('submit', handleReviewFormSubmit);
}

// --- LÓGICA DE FILTROS ---

async function populateFilters() {
    try {
        const [catRes, brandRes] = await Promise.all([
            fetch('/api/categorias'),
            fetch('/api/marcas')
        ]);
        const categories = await catRes.json();
        const brands = await brandRes.json();

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id_categoria;
            option.textContent = cat.nombre;
            categoryFilter.appendChild(option);
        });

        brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand.id_marca;
            option.textContent = brand.nombre;
            brandFilter.appendChild(option);
        });

    } catch (error) {
        console.error("Error al cargar filtros:", error);
    }
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedBrand = brandFilter.value;

    const filteredProducts = allProducts.filter(product => {
        const matchesSearch = product.nombre.toLowerCase().includes(searchTerm) || (product.descripcion && product.descripcion.toLowerCase().includes(searchTerm));
        const matchesCategory = !selectedCategory || product.id_categoria == selectedCategory;
        const matchesBrand = !selectedBrand || product.id_marca == selectedBrand;
        return matchesSearch && matchesCategory && matchesBrand;
    });

    renderProducts(filteredProducts);
}

if (searchInput) searchInput.addEventListener('input', applyFilters);
if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
if (brandFilter) brandFilter.addEventListener('change', applyFilters);
if (resetFiltersButton) resetFiltersButton.addEventListener('click', () => {
    searchInput.value = '';
    categoryFilter.value = '';
    brandFilter.value = '';
    applyFilters();
});
// 3. Iniciar la carga de productos
async function initProductsPage() {
    await fetchProducts();
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    // Mostrar formularios de reseña si el usuario está logueado
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        document.querySelectorAll('.review-form').forEach(form => form.style.display = 'block');
    }

    // Cargar los filtros
    await populateFilters();
}

initProductsPage();