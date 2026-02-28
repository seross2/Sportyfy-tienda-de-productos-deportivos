// Este código se ejecuta en el navegador del cliente
import { shoppingCart } from '/js/cart-logic.js';
import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';
import '/js/global.js'; // Importamos la lógica global del menú

class ProductApp {
    constructor() {
        this.productGrid = document.querySelector('.product-grid') || document.getElementById('product-list');
        this.paginationContainer = document.getElementById('pagination-container');
        this.searchInput = document.getElementById('search-input');
        this.categoryFilter = document.getElementById('category-filter');
        this.brandFilter = document.getElementById('brand-filter');
        this.priceFilter = document.getElementById('price-filter');
        this.priceOutput = document.getElementById('price-output');
        this.resetFiltersButton = document.getElementById('reset-filters');
        this.currentPage = 1;
        this.allProducts = [];
        
        // Solo iniciar si estamos en la página de productos (si existe la grilla)
        if (this.productGrid) {
            this.init();
        }
    }

    async init() {
        this.setupFilterListeners();

        if (this.searchInput) this.searchInput.addEventListener('input', () => this.applyFilters());
        if (this.categoryFilter) this.categoryFilter.addEventListener('change', () => this.applyFilters());
        if (this.brandFilter) this.brandFilter.addEventListener('change', () => this.applyFilters());
        if (this.priceFilter) {
            this.priceFilter.addEventListener('input', () => this.updatePriceOutput());
            this.priceFilter.addEventListener('change', () => this.applyFilters());
        }
        if (this.resetFiltersButton) this.resetFiltersButton.addEventListener('click', () => {
            this.searchInput.value = '';
            this.categoryFilter.value = '';
            this.brandFilter.value = '';
            if (this.priceFilter) {
                this.priceFilter.value = this.priceFilter.max;
                this.updatePriceOutput();
            }
            this.applyFilters();
        });

        if (this.priceFilter) this.updatePriceOutput();

        await this.fetchProducts(this.currentPage);
        await this.populateFilters();

    }

    setupFilterListeners() {
        this.productGrid.addEventListener('click', (event) => {
            if (event.target.matches('.add-to-cart-btn')) {
                const productId = event.target.dataset.productId;
                const productToAdd = this.allProducts.find(p => p.id_producto === Number(productId));
                if (productToAdd) {
                    shoppingCart.addProduct(productToAdd);
                    showToast(`"${productToAdd.nombre}" ha sido añadido al carrito.`);
                }
            }
        });
    }

    async fetchProducts(page = 1) {
        this.currentPage = page;
        try {
            this.productGrid.innerHTML = '<p>Cargando productos...</p>';
            if (this.paginationContainer) this.paginationContainer.innerHTML = '';

            const params = new URLSearchParams({ page: this.currentPage.toString() });
            if (this.searchInput && this.searchInput.value) params.append('search', this.searchInput.value);
            if (this.categoryFilter && this.categoryFilter.value) params.append('id_categoria', this.categoryFilter.value);
            if (this.brandFilter && this.brandFilter.value) params.append('id_marca', this.brandFilter.value);
            if (this.priceFilter && parseInt(this.priceFilter.value) < parseInt(this.priceFilter.max)) {
                params.append('max_precio', this.priceFilter.value);
            }

            const response = await fetch(`/api/products?${params.toString()}`);
            if (!response.ok) {
                throw new Error('La respuesta de la red no fue correcta');
            }
            const { products, totalCount } = await response.json();
            this.allProducts = products;

            this.renderProducts(products);
            this.renderPaginationControls(totalCount);
        } catch (error) {
            this.productGrid.innerHTML = '<p>No se pudieron cargar los productos. Inténtalo de nuevo más tarde.</p>';
            console.error('Error fetching products:', error);
        }
    }

    renderProducts(products) {
        this.productGrid.innerHTML = '';
        if (products.length === 0) {
            this.productGrid.innerHTML = '<p>No se encontraron productos que coincidan con tu búsqueda.</p>';
            return;
        }

        products.forEach((product, index) => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.style.animationDelay = `${index * 0.05}s`;

            const averageRating = product.average_rating || 0;
            const fullStars = Math.min(5, Math.max(0, Math.round(averageRating)));
            const emptyStars = 5 - fullStars;

            productCard.innerHTML = `
                <img src="${product.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${product.nombre}">
                <div class="card-content">
                    <h3>${product.nombre}</h3>
                    <p>${product.marcas?.nombre || ''}</p>
                    <p class="price">${shoppingCart.formatPrice(product.precio)}</p>
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
            this.productGrid.appendChild(productCard);
        });
    }

    renderPaginationControls(totalCount) {
        if (!this.paginationContainer) return;

        const limit = 12;
        const totalPages = Math.ceil(totalCount / limit);
        this.paginationContainer.innerHTML = '';

        if (totalPages <= 1) return;

        let paginationHTML = `<button class="pagination-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo; Anterior</button>`;

        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>`;
        }

        paginationHTML += `
            <button class="pagination-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>
                Siguiente &raquo;
            </button>
        `;

        this.paginationContainer.innerHTML = paginationHTML;

        this.paginationContainer.querySelectorAll('.pagination-btn:not(:disabled)').forEach(button => {
            button.addEventListener('click', (e) => this.fetchProducts(parseInt(e.target.dataset.page)));
        });
    }

    async populateFilters() {
        if (!this.categoryFilter && !this.brandFilter) return;

        try {
            const [catRes, brandRes] = await Promise.all([
                fetch('/api/categorias'),
                fetch('/api/marcas')
            ]);
            const categories = await catRes.json();
            const brands = await brandRes.json();

            if (this.categoryFilter) {
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id_categoria;
                    option.textContent = cat.nombre;
                    this.categoryFilter.appendChild(option);
                });
            }

            if (this.brandFilter) {
                brands.forEach(brand => {
                    const option = document.createElement('option');
                    option.value = brand.id_marca;
                    option.textContent = brand.nombre;
                    this.brandFilter.appendChild(option);
                });
            }

        } catch (error) {
            console.error("Error al cargar filtros:", error);
        }
    }

    updatePriceOutput() {
        if (this.priceOutput && this.priceFilter) {
            const valueInCents = parseInt(this.priceFilter.value, 10);
            this.priceOutput.textContent = shoppingCart.formatPrice(valueInCents);
        }
    }

    applyFilters() {
        this.fetchProducts(1);
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    new ProductApp();
});