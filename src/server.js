import express from 'express';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

dotenv.config(); // Carga el .env desde la raíz del proyecto

const app = express();
const PORT = 3000;

// Configuración de Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Endpoint para el Webhook de Stripe
// ¡IMPORTANTE! Esta ruta debe definirse ANTES de app.use(express.json())
// porque Stripe necesita el cuerpo de la solicitud en formato raw (sin procesar).
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`❌ Error message: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const id_pedido = session.metadata.id_pedido;

    try {
      // Actualizar el estado del pedido a 'Pagado'
      await supabase.from('pedidos').update({ estado: 'Pagado' }).eq('id_pedido', id_pedido);

      // Registrar el pago en la tabla de pagos
      await supabase.from('pagos').insert({
        id_pedido: id_pedido,
        monto: session.amount_total, // Stripe devuelve el monto en centavos
        metodo: 'Stripe',
        stripe_payment_id: session.payment_intent,
        estado_pago: 'Completado'
      });

      // ¡Llamar a la función para reducir el stock!
      await supabase.rpc('reducir_stock_pedido', { p_id_pedido: id_pedido });

    } catch (error) {
      console.error('Error al actualizar el pedido o registrar el pago:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.json({ received: true });
});

// Ahora, usamos el middleware de JSON para el resto de las rutas.
app.use(express.json());

// Servir archivos estáticos (HTML, CSS, JS del cliente)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configuración de Supabase (para el servidor)
// Usamos la SERVICE_KEY aquí para tener permisos de administrador en el backend.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// --- MIDDLEWARE DE AUTENTICACIÓN ---
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
  if (!token) {
    return res.status(401).json({ error: 'No token provided. Unauthorized.' });
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token. Unauthorized.' });
  }
  req.user = user;
  next();
};

const adminMiddleware = async (req, res, next) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', req.user.id)
    .single();

  if (error || !profile) {
    return res.status(500).json({ error: 'No se pudo verificar el perfil del usuario.' });
  }

  if (profile.rol !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// --- 2. RUTAS (ENDPOINTS) DE LA API ---

// Ruta para que el frontend obtenga la configuración pública de Supabase
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// Ruta para obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    // Construir la consulta dinámicamente basada en los filtros
    let query = supabase
      .from('productos')
      .select('*, categorias(nombre), marcas(nombre), reseñas(puntuacion)');

    const { search, id_categoria, id_marca, max_precio } = req.query;

    if (search) {
      query = query.ilike('nombre', `%${search}%`);
    }
    if (id_categoria) {
      query = query.eq('id_categoria', id_categoria);
    }
    if (id_marca) {
      query = query.eq('id_marca', id_marca);
    }
    if (max_precio) {
      query = query.lte('precio', max_precio); // lte = Less Than or Equal
    }

    const { data, error } = await query;
    if (error) throw error;

    // Post-procesamiento para calcular el promedio de reseñas
    const productsWithAvgRating = data.map(product => {
      const reviews = product.reseñas || [];
      let average_rating = 0;
      if (reviews.length > 0) {
        const totalScore = reviews.reduce((acc, review) => acc + review.puntuacion, 0);
        average_rating = totalScore / reviews.length;
      }
      // Limpiamos el array de reseñas para no enviar datos innecesarios al frontend
      const { reseñas, ...productData } = product;
      return { ...productData, average_rating };
    });

    res.json(productsWithAvgRating);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los productos', details: error.message });
  }
});

// Ruta para obtener UN solo producto por ID
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre), marcas(nombre)')
      .eq('id_producto', id)
      .single(); // .single() para obtener un solo objeto en lugar de un array

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el producto', details: error.message });
  }
});

// Ruta para obtener todas las categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categorias').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las categorías', details: error.message });
  }
});

// Ruta para obtener todas las marcas
app.get('/api/marcas', async (req, res) => {
  try {
    const { data, error } = await supabase.from('marcas').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las marcas', details: error.message });
  }
});

// Ruta para obtener todas las tallas
app.get('/api/tallas', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tallas').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las tallas', details: error.message });
  }
});

// Ruta para AÑADIR un nuevo producto (protegida)
app.post('/api/products', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nombre, descripcion, precio, imagen_url, stock, id_categoria, id_marca, id_talla } = req.body;
    if (!nombre || !precio || !imagen_url || stock === undefined) {
      return res.status(400).json({ error: 'Nombre, precio, imagen y stock son requeridos.' });
    } 
    const { data, error } = await supabase
      .from('productos')
      .insert([{ nombre, descripcion, precio, imagen_url, stock, id_categoria, id_marca, id_talla }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir el producto', details: error.message });
  }
});

// Ruta para AÑADIR una nueva categoría (protegida)
app.post('/api/categorias', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
  try {
    const { data, error } = await supabase.from('categorias').insert({ nombre }).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir la categoría', details: error.message });
  }
});

// Ruta para AÑADIR una nueva marca (protegida)
app.post('/api/marcas', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
  try {
    const { data, error } = await supabase.from('marcas').insert({ nombre }).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir la marca', details: error.message });
  }
});

// Ruta para AÑADIR una nueva talla (protegida)
app.post('/api/tallas', authMiddleware, adminMiddleware, async (req, res) => {
  const { tipo, valor } = req.body;
  if (!tipo || !valor) return res.status(400).json({ error: 'Tipo y valor son requeridos.' });
  try {
    const { data, error } = await supabase.from('tallas').insert({ tipo, valor }).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir la talla', details: error.message });
  }
});

// Ruta para ACTUALIZAR un producto existente (protegida)
app.put('/api/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { nombre, descripcion, precio, imagen_url, stock, id_categoria, id_marca, id_talla } = req.body;
    if (!nombre || !precio || !imagen_url || stock === undefined) {
      return res.status(400).json({ error: 'Todos los campos principales son requeridos.' });
    }
    const { data, error } = await supabase
      .from('productos')
      .update({ nombre, descripcion, precio, imagen_url, stock, id_categoria, id_marca, id_talla })
      .eq('id_producto', id)
      .select();

    if (error) throw error;
    if (data.length === 0) return res.status(404).json({ error: 'Producto no encontrado para actualizar.' });

    res.status(200).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el producto', details: error.message });
  }
});

// Ruta para ACTUALIZAR una categoría (protegida)
app.put('/api/categorias/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
  try {
    const { data, error } = await supabase.from('categorias').update({ nombre }).eq('id_categoria', id).select();
    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la categoría', details: error.message });
  }
});

// Ruta para ACTUALIZAR una marca (protegida)
app.put('/api/marcas/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
  try {
    const { data, error } = await supabase.from('marcas').update({ nombre }).eq('id_marca', id).select();
    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la marca', details: error.message });
  }
});

// Ruta para ACTUALIZAR una talla (protegida)
app.put('/api/tallas/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { tipo, valor } = req.body;
  if (!tipo || !valor) return res.status(400).json({ error: 'Tipo y valor son requeridos.' });
  try {
    const { data, error } = await supabase.from('tallas').update({ tipo, valor }).eq('id_talla', id).select();
    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la talla', details: error.message });
  }
});

// Ruta para ELIMINAR un producto (protegida)
app.delete('/api/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('productos').delete().eq('id_producto', id);
    if (error) throw error;
    res.status(204).send(); // 204 No Content: éxito sin devolver datos
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el producto', details: error.message });
  }
});

// Ruta para ELIMINAR una categoría (protegida)
app.delete('/api/categorias/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('categorias').delete().eq('id_categoria', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la categoría', details: error.message });
  }
});

// Ruta para ELIMINAR una marca (protegida)
app.delete('/api/marcas/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('marcas').delete().eq('id_marca', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la marca', details: error.message });
  }
});

// Ruta para ELIMINAR una talla (protegida)
app.delete('/api/tallas/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('tallas').delete().eq('id_talla', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la talla', details: error.message });
  }
});
// --- RUTAS PARA RESEÑAS ---

// Obtener reseñas de un producto específico
app.get('/api/reviews/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const { data, error } = await supabase
      .from('reseñas')
      .select('*, profiles(username)') // Asumimos que tienes una tabla 'profiles'
      .eq('id_producto', productId)
      .order('fecha', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las reseñas', details: error.message });
  }
});

// Añadir una nueva reseña (protegida)
app.post('/api/reviews', authMiddleware, async (req, res) => {
  const { id_producto, puntuacion, comentario } = req.body;
  const id_usuario = req.user.id; // Obtenido del token en authMiddleware

  try {
    // --- VALIDACIÓN: ¿El usuario compró este producto? ---
    const { data: haComprado, error: rpcError } = await supabase
      .rpc('usuario_compro_producto', {
        p_id_usuario: id_usuario,
        p_id_producto: id_producto
      });

    if (rpcError) throw rpcError;

    if (!haComprado) {
      return res.status(403).json({ error: 'Solo puedes dejar una reseña si has comprado este producto.' });
    }

    const { data, error } = await supabase.from('reseñas').insert([{ id_producto, id_usuario, puntuacion, comentario }]).select();
    if (error) return res.status(500).json({ error: 'Error al guardar la reseña', details: error.message });
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la reseña', details: error.message });
  }
});
// --- 3. RUTAS PARA PEDIDOS Y PAGOS ---

// Endpoint para crear un pedido y obtener la sesión de Stripe
app.post('/api/orders', authMiddleware, async (req, res) => {
  const { items, direccion_envio, telefono_contacto, notas } = req.body;
  const id_usuario = req.user.id;

  if (!items || items.length === 0) return res.status(400).json({ error: 'No hay items en el carrito' });
  if (!direccion_envio || !telefono_contacto) return res.status(400).json({ error: 'La dirección y el teléfono son requeridos.' });

  try {
    // 1. Crear el pedido en la base de datos con estado 'Pendiente'
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({ id_usuario, direccion_envio, telefono_contacto, notas, estado: 'Pendiente' })
      .select('id_pedido')
      .single();

    if (pedidoError) throw pedidoError;

    // 1.5. Guardar los detalles del pedido en la nueva tabla 'pedido_detalle'
    const detallesPedido = items.map(item => ({
      id_pedido: pedido.id_pedido,
      id_producto: item.id_producto,
      cantidad: item.quantity, 
      precio_unitario: item.precio // El precio ya está en la unidad correcta
    }));

    const { error: detalleError } = await supabase.from('pedido_detalle').insert(detallesPedido);
    if (detalleError) throw detalleError;

    // 2. Preparar los items para Stripe
    const line_items = items.map(item => ({
      price_data: {
        currency: 'cop',
        product_data: {
          name: item.nombre,
          images: [item.imagen_url],
        },
        unit_amount: item.precio,
      },
      quantity: item.quantity,
    }));

    // 3. Crear la sesión de Checkout en Stripe, incluyendo el ID del pedido en los metadatos
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: `http://localhost:${PORT}/pago-exitoso.html`,
      cancel_url: `http://localhost:${PORT}/pago-cancelado.html`,
      metadata: {
        id_pedido: pedido.id_pedido, // ¡Muy importante para el webhook!
      }
    });

    // 4. Devolver la URL de la sesión de Stripe al frontend
    res.json({ url: session.url });
  } catch (error) {
    console.error('--- ERROR DETALLADO AL CREAR PEDIDO ---');
    console.error(error);
    res.status(500).json({ error: 'Error al crear el pedido', details: error.message || 'Error desconocido en el servidor.' });
  }
});

// Ruta para obtener el historial de pedidos de un usuario (protegida)
app.get('/api/user/orders', authMiddleware, async (req, res) => {
  const id_usuario = req.user.id;
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id_usuario', id_usuario)
      .order('fecha_pedido', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial de pedidos', details: error.message });
  }
});

// --- 4. RUTA PARA ENVIAR CORREOS ---
app.post('/api/send-email', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  }

  // Configura el transportador de nodemailer (ejemplo con Gmail)
  const transporter = nodemailer.createTransport({
    service: 'gmail', // o tu proveedor de correo
    auth: {
      user: process.env.EMAIL_USER, // Tu correo desde .env
      pass: process.env.EMAIL_PASS, // Tu contraseña de aplicación desde .env
    },
  });

  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.EMAIL_TO, // El correo donde recibirás los mensajes
    subject: `Nuevo mensaje de contacto de ${name}`,
    text: `Has recibido un nuevo mensaje de:\n\nNombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: 'Mensaje enviado con éxito.' });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    res.status(500).json({ error: 'Error interno al enviar el correo.' });
  }
});

// --- 5. INICIAR EL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});