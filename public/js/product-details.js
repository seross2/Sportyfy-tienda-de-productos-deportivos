import { showToast } from '/js/utils.js';
import { getSupabaseClient } from '/js/supabaseClient.js';
import { addProductToCart } from '/js/cart-logic.js';

const productId = new URLSearchParams(window.location.search).get('id');
const productContainer = document.getElementById('product-detail-container');
const reviewsList = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');

if (!productId) {
    productContainer.innerHTML = '<p>Producto no encontrado. <a href="/">Volver a la tienda</a>.</p>';
}

async function fetchProductDetails() {
    try {
        const response = await fetch(`/api/products/${productId}`);
        if (!response.ok) throw new Error('Producto no encontrado.');
        const product = await response.json();

        document.title = `${product.nombre} - Sportify Store`;
        renderProduct(product);
        
        // Añadir evento al botón "Añadir al Carrito" después de renderizar
        const addToCartBtn = document.getElementById('add-to-cart-detail-btn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                const productForCart = {
                    id_producto: product.id_producto,
                    nombre: product.nombre,
                    precio: product.precio,
                    imagen_url: product.imagen_url,
                };
                addProductToCart(productForCart);
                showToast(`'${product.nombre}' añadido al carrito.`, 'success');
            });
        }

    } catch (error) {
        productContainer.innerHTML = `<p>${error.message} <a href="/">Volver a la tienda</a>.</p>`;
        console.error(error);
    }
}

function renderProduct(product) {
    productContainer.innerHTML = `
        <div class="product-detail-image">
            <img src="${product.imagen_url}" alt="${product.nombre}">
        </div>
        <div class="product-detail-info">
            <h1>${product.nombre}</h1>
            <p class="brand">${product.marcas.nombre}</p>
            <p class="description">${product.descripcion || 'No hay descripción disponible.'}</p>
            <p class="price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(product.precio / 100)}</p>
            <button id="add-to-cart-detail-btn" class="btn btn-primary">Añadir al Carrito</button>
        </div>
    `;
}

async function fetchReviews() {
    try {
        const response = await fetch(`/api/reviews/${productId}`);
        const reviews = await response.json();

        reviewsList.innerHTML = '';
        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p>Aún no hay reseñas para este producto. ¡Sé el primero!</p>';
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
            reviewsList.appendChild(reviewElement);
        });

    } catch (error) {
        reviewsList.innerHTML = '<p>Error al cargar las reseñas.</p>';
        console.error(error);
    }
}

async function handleReviewSubmit(event) {
    event.preventDefault();
    const submitButton = reviewForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const formData = new FormData(reviewForm);
    const reviewData = {
        id_producto: parseInt(productId),
        puntuacion: parseInt(formData.get('puntuacion')),
        comentario: formData.get('comentario')
    };

    try {
        const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reviewData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo enviar la reseña.');

        showToast('¡Gracias por tu reseña!', 'success');
        reviewForm.reset();
        fetchReviews(); // Recargar reseñas para ver la nueva

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Reseña';
    }
}

async function init() {
    if (productId) {
        await fetchProductDetails();
        await fetchReviews();
        
        const toggleBtn = document.getElementById('toggle-review-form-btn');
        const reviewForm = document.getElementById('review-form');
        
        toggleBtn.addEventListener('click', async () => {
            // Mostrar u ocultar el formulario
            const isVisible = reviewForm.style.display === 'block';
            reviewForm.style.display = isVisible ? 'none' : 'block';
        });
        
        reviewForm.addEventListener('submit', handleReviewSubmit);
    }
}

document.addEventListener('DOMContentLoaded', init);