import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

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

    selectElement.innerHTML = `<option value="">-- Selecciona una opción --</option>`; // Limpiar y poner opción por defecto

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item[valueField];
      option.textContent = item[textField];
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error(`Error populando ${selectElement.id}:`, error);
    selectElement.innerHTML = `<option value="">Error al cargar</option>`;
  }
}

/**
 * Maneja el envío del formulario para añadir un nuevo producto.
 */
async function handleAddProduct(event) {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Añadiendo...';

  const supabase = await getSupabaseClient();
  if (!supabase) return showToast('Error de configuración.', 'error');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return showToast('Tu sesión ha expirado. Por favor, recarga la página.', 'error');

  const formData = new FormData(form);
  const productData = {
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    precio: Math.round(parseFloat(formData.get('precio')) * 100), // Guardar en centavos de forma segura
    imagen_url: formData.get('imagen_url'),
    stock: parseInt(formData.get('stock'), 10),
    id_categoria: parseInt(formData.get('id_categoria'), 10),
    id_marca: parseInt(formData.get('id_marca'), 10),
    id_talla: parseInt(formData.get('id_talla'), 10)
  };

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'No se pudo añadir el producto.');
    }

    showToast('¡Producto añadido con éxito!', 'success');
    form.reset();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Añadir Producto';
  }
}

// Inicializar el panel de administrador
const addProductForm = document.getElementById('add-product-form');
const categorySelect = document.getElementById('categoria');
const brandSelect = document.getElementById('marca');
const sizeSelect = document.getElementById('talla');

if (addProductForm && categorySelect && brandSelect && sizeSelect) {
  populateSelect(categorySelect, '/api/categorias', 'id_categoria', 'nombre');
  populateSelect(brandSelect, '/api/marcas', 'id_marca', 'nombre');
  populateSelect(sizeSelect, '/api/tallas', 'id_talla', 'valor');
  addProductForm.addEventListener('submit', handleAddProduct);
}