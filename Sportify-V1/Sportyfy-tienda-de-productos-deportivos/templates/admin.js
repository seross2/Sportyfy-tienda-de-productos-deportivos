import { getSupabaseClient } from '/supabaseClient.js';

// --- Cargar Categorías y Marcas en los Selects ---
async function populateSelect(endpoint, selectId, nameField) {
    const selectElement = document.getElementById(selectId);
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Error al cargar datos');
        const items = await response.json();

        selectElement.innerHTML = `<option value="">-- Selecciona una opción --</option>`;

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item[nameField];
            selectElement.appendChild(option);
        });
    } catch (error) {
        selectElement.innerHTML = `<option value="">Error al cargar</option>`;
        console.error(`Error populando ${selectId}:`, error);
    }
}

async function initializeAdminPanel() {
    const supabase = await getSupabaseClient();
    if (!supabase) {
        document.getElementById('message').textContent = 'Error: No se pudo inicializar la conexión con la base de datos.';
        return;
    }

    populateSelect('/api/categorias', 'categoria', 'nombre');
    populateSelect('/api/marcas', 'marca', 'nombre');

    const form = document.getElementById('add-product-form');
    const messageDiv = document.getElementById('message');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const productData = {
            name: formData.get('name'),
            description: formData.get('description'),
            price: Math.round(parseFloat(formData.get('price')) * 100),
            imageUrl: formData.get('imageUrl'),
            stock: parseInt(formData.get('stock'), 10),
            categoria_id: formData.get('categoria_id'),
            marca_id: formData.get('marca_id')
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No has iniciado sesión.');

            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(productData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en la respuesta del servidor');
            }

            const newProduct = await response.json();
            messageDiv.textContent = `Producto "${newProduct.name}" añadido con éxito.`;
            messageDiv.style.color = 'green';
            form.reset();
        } catch (error) {
            messageDiv.textContent = `Error: ${error.message}`;
            messageDiv.style.color = 'red';
        }
    });
}

initializeAdminPanel();