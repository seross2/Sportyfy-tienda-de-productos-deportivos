import { showToast } from '/js/utils.js';
import { getSupabaseClient } from '/js/supabaseClient.js';
import { shoppingCart } from '/js/cart-logic.js';

class ProductDetailsPage {
    constructor() {
        this.productId = new URLSearchParams(window.location.search).get('id');
        this.productContainer = document.getElementById('product-detail-container');
        this.reviewsList = document.getElementById('reviews-list');
        this.reviewForm = document.getElementById('review-form');
        
        this.init();
    }

    async init() {
        if (!this.productId) {
            this.productContainer.innerHTML = '<p>Producto no encontrado. <a href="/">Volver a la tienda</a>.</p>';
            return;
        }

        await this.fetchProductDetails();
        await this.fetchReviews();
        
        const toggleBtn = document.getElementById('toggle-review-form-btn');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = this.reviewForm.style.display === 'block';
                this.reviewForm.style.display = isVisible ? 'none' : 'block';
            });
        }
        
        if (this.reviewForm) {
            this.reviewForm.addEventListener('submit', (e) => this.handleReviewSubmit(e));
        }
    }

    async fetchProductDetails() {
        try {
            const response = await fetch(`/api/products/${this.productId}`);
            if (!response.ok) throw new Error('Producto no encontrado.');
            const product = await response.json();

            document.title = `${product.nombre} - Sportify Store`;
            this.renderProduct(product);
            
            const addToCartBtn = document.getElementById('add-to-cart-detail-btn');
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', () => {
                    const productForCart = {
                        id_producto: product.id_producto,
                        nombre: product.nombre,
                        precio: product.precio,
                        imagen_url: product.imagen_url,
                    };
                    shoppingCart.addProduct(productForCart);
                    showToast(`'${product.nombre}' añadido al carrito.`, 'success');
                });
            }

        } catch (error) {
            this.productContainer.innerHTML = `<p>${error.message} <a href="/">Volver a la tienda</a>.</p>`;
            console.error(error);
        }
    }

    renderProduct(product) {
        this.productContainer.innerHTML = `
            <div class="product-detail-image">
                <img src="${product.imagen_url}" alt="${product.nombre}">
            </div>
            <div class="product-detail-info">
                <h1>${product.nombre}</h1>
                <p class="brand">${product.marcas.nombre}</p>
                <p class="description">${product.descripcion || 'No hay descripción disponible.'}</p>
            <p class="price">${shoppingCart.formatPrice(product.precio)}</p>
                <button id="add-to-cart-detail-btn" class="btn btn-primary">Añadir al Carrito</button>
            </div>
        `;
    }

    async fetchReviews() {
        try {
            const response = await fetch(`/api/reviews/${this.productId}`);
            const reviews = await response.json();

            this.reviewsList.innerHTML = '';
            if (reviews.length === 0) {
                this.reviewsList.innerHTML = '<p>Aún no hay reseñas para este producto. ¡Sé el primero!</p>';
                return;
            }

            reviews.forEach(review => {
                const reviewElement = document.createElement('div');
                reviewElement.className = 'review-item';
                reviewElement.innerHTML = `
                    <div class="review-header">
                        <strong>${review.profiles.username || 'Anónimo'}</strong>
                        <span class="review-stars">${'&#9733;'.repeat(review.puntuacion)}${'&#9734;'.repeat(5 - review.puntuacion)}</span>
                    </div>
                    <p class="review-comment">${review.comentario}</p>
                    <p class="review-date">${new Date(review.fecha).toLocaleDateString('es-CO')}</p>
                `;
                this.reviewsList.appendChild(reviewElement);
            });

        } catch (error) {
            this.reviewsList.innerHTML = '<p>Error al cargar las reseñas.</p>';
            console.error(error);
        }
    }

    async handleReviewSubmit(event) {
        event.preventDefault();

        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            showToast('Debes iniciar sesión para dejar una reseña.', 'error');
            return;
        }

        if (!session.access_token) {
            showToast('Error de sesión: No se encontró el token. Por favor, inicia sesión nuevamente.', 'error');
            return;
        }

        const submitButton = this.reviewForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const formData = new FormData(this.reviewForm);
        const reviewData = {
            id_producto: parseInt(this.productId),
            puntuacion: parseInt(formData.get('puntuacion')),
            comentario: formData.get('comentario')
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

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'No se pudo enviar la reseña.');

            showToast('¡Gracias por tu reseña!', 'success');
            this.reviewForm.reset();
            this.fetchReviews();

        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar Reseña';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ProductDetailsPage());