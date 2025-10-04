// Este código se ejecuta en el navegador del cliente
import { addProductToCart } from '/cart-logic.js';
import { showToast } from '/utils.js';

const productGrid = document.querySelector('.product-grid');
let allProducts = []; // Variable para almacenar los productos una vez cargados

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
    products.forEach(product => {
      const productItem = document.createElement('div');
      productItem.className = 'product-item';
      // Asumimos que tu tabla 'products' tiene columnas: imageUrl, name, description, price (en centavos)
      productItem.innerHTML = `
        <img src="${product.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${product.nombre}">
        <h3>${product.nombre}</h3>
        <p>${product.descripcion}</p>
        <span class="price">$${(product.precio / 100).toFixed(2)}</span>
        <button class="btn add-to-cart-btn" data-product-id="${product.id_producto}">Añadir al Carrito</button>
      `;
      productGrid.appendChild(productItem);
    });
    // Usaremos delegación de eventos en lugar de esta función
  } catch (error) {
    productGrid.innerHTML = '<p>No se pudieron cargar los productos. Inténtalo de nuevo más tarde.</p>';
    console.error('Error fetching products:', error);
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
}

// 3. Iniciar la carga de productos
fetchProducts();