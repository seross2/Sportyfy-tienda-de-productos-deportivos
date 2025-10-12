import { addProductToCart } from '/js/cart-logic.js';
import { showToast } from '/js/utils.js';

const productContainer = document.getElementById('product-list');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const brandFilter = document.getElementById('brand-filter');
const priceFilter = document.getElementById('price-filter');
const clearFiltersButton = document.getElementById('reset-filters');
let allProducts = []; // Almacenar todos los productos para la delegación de eventos

/**
 * Popula un elemento <select> con opciones desde una API.
 * @param {HTMLElement} selectElement El elemento <select> a poblar.
 * @param {string} endpoint El endpoint de la API para obtener los datos.
 * @param {string} valueField El nombre del campo para el `value` de la opción.
 * @param {string} textField El nombre del campo para el texto de la opción.
 */
async function populateSelect(selectElement, endpoint, valueField, textField) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`No se pudo cargar ${endpoint}`);
        const items = await response.json();

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error(`Error populando ${selectElement.id}:`, error);
    }
}

async function fetchAndDisplayProducts() {
    if (!productContainer) return;

    try {
        // Construir la URL con los filtros actuales
        const params = new URLSearchParams();
        if (searchInput.value) params.append('search', searchInput.value);
        if (categoryFilter.value) params.append('id_categoria', categoryFilter.value);
        if (brandFilter.value) params.append('id_marca', brandFilter.value);
        // Añadir el filtro de precio si no es el valor máximo
        const maxPrice = parseInt(priceFilter.value, 10);
        if (maxPrice < parseInt(priceFilter.max, 10)) {
            params.append('max_precio', maxPrice * 100); // Convertir a centavos para el backend
        }

        const response = await fetch(`/api/products?${params.toString()}`);
        if (!response.ok) throw new Error('No se pudieron cargar los productos.');
        
        const products = await response.json();
        allProducts = products; // Guardar productos en la variable global
        
        productContainer.innerHTML = ''; // Limpiar antes de añadir

        if (products.length === 0) {
            productContainer.innerHTML = '<p>No hay productos disponibles en este momento.</p>';
            return;
        }

        products.forEach((product, index) => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card'; // Asegúrate de tener esta clase en tu CSS
            
            // Añadir un retraso escalonado a la animación de cada tarjeta
            productCard.style.animationDelay = `${index * 0.05}s`;

            const averageRating = product.average_rating || 0;
            const fullStars = Math.round(averageRating);
            const emptyStars = 5 - fullStars;

            productCard.innerHTML = `
                <img src="${product.imagen_url}" alt="${product.nombre}">
                <div class="card-content">
                    <h3>${product.nombre}</h3>
                    <p>${product.marcas.nombre}</p>
                    <p class="price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(product.precio / 100)}</p>
                    <div class="product-rating">
                        <span class="rating-number">${averageRating > 0 ? averageRating.toFixed(1) : 'N/A'}</span>
                        <span class="stars">${averageRating > 0 ? '&#9733;'.repeat(fullStars) + '&#9734;'.repeat(emptyStars) : ''}</span>
                    </div>
                </div>
                <div class="card-buttons">
                    <a href="/product.html?id=${product.id_producto}" class="btn btn-secondary">Ver más</a>
                    <button class="btn btn-primary add-to-cart-btn" data-product-id="${product.id_producto}">Añadir</button>
                </div>
            `;
            productContainer.appendChild(productCard);
        });

    } catch (error) {
        console.error('Error al cargar productos:', error);
        productContainer.innerHTML = '<p>Error al cargar los productos. Intenta de nuevo más tarde.</p>';
    }
}

function initializeFilters() {
    // Poblar los selectores de categoría y marca
    populateSelect(categoryFilter, '/api/categorias', 'id_categoria', 'nombre');
    populateSelect(brandFilter, '/api/marcas', 'id_marca', 'nombre');

    const priceOutput = document.getElementById('price-output');
    const updatePriceOutput = () => {
        const value = parseInt(priceFilter.value);
        const formattedPrice = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
        priceOutput.textContent = formattedPrice;
    };

    // Añadir eventos para volver a cargar productos cuando cambien los filtros
    searchInput.addEventListener('input', fetchAndDisplayProducts);
    categoryFilter.addEventListener('change', fetchAndDisplayProducts);
    brandFilter.addEventListener('change', fetchAndDisplayProducts);
    priceFilter.addEventListener('input', updatePriceOutput); // Actualiza el texto mientras se desliza
    priceFilter.addEventListener('change', fetchAndDisplayProducts); // Llama a la API al soltar

    // Evento para el botón de limpiar filtros
    clearFiltersButton.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        brandFilter.value = '';
        priceFilter.value = priceFilter.max; // Restablecer al máximo
        updatePriceOutput();
        fetchAndDisplayProducts();
    });
}

function init() {
    initializeFilters();
    fetchAndDisplayProducts();
    document.getElementById('price-filter').dispatchEvent(new Event('input')); // Actualizar el precio al cargar
}

// Usar delegación de eventos para manejar los clics en los botones "Añadir al Carrito"
productContainer.addEventListener('click', (event) => {
    if (event.target.matches('.add-to-cart-btn')) {
        const productId = event.target.dataset.productId;
        // Encontrar el producto completo desde nuestra lista guardada
        const productToAdd = allProducts.find(p => p.id_producto == productId);

        if (productToAdd) {
            // CORRECCIÓN: Crear un objeto plano para el carrito para evitar problemas de estructura.
            // Esto asegura que no guardamos datos anidados (como product.marcas) en el localStorage.
            const productForCart = {
                id_producto: productToAdd.id_producto,
                nombre: productToAdd.nombre,
                precio: productToAdd.precio,
                imagen_url: productToAdd.imagen_url,
            };

            addProductToCart(productForCart);
            showToast(`'${productToAdd.nombre}' añadido al carrito.`, 'success');
        }
    }
});

document.addEventListener('DOMContentLoaded', init);