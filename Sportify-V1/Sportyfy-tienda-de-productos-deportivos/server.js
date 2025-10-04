import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

// --- 1. CONFIGURACIÓN ---
const app = express();
const PORT = 3000;
app.use(express.json());

// Servir archivos estáticos (HTML, CSS, JS del cliente)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'templates')));

// Configuración de Supabase (para el servidor)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Configuración de Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  const { data, error } = await supabase.from('profiles').select('rol').eq('id', req.user.id).single();
  if (error || !data || data.rol !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// --- 2. RUTAS (ENDPOINTS) DE LA API ---

// Ruta para obtener todos los productos

// Ruta para enviar la configuración pública al frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre), marcas(nombre)');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los productos', details: error.message });
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

// Ruta para AÑADIR un nuevo producto (protegida)
app.post('/api/products', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, imageUrl, stock, categoria_id, marca_id } = req.body;
    if (!name || !price || !imageUrl || stock === undefined) {
      return res.status(400).json({ error: 'Nombre, precio, imagen y stock son requeridos.' });
    }
    const { data, error } = await supabase
      .from('productos')
      .insert([{ name, description, price, imageUrl, stock, categoria_id, marca_id }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir el producto', details: error.message });
  }
});

// --- 3. RUTA PARA PAGOS CON STRIPE ---
app.post('/api/create-checkout-session', authMiddleware, async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No hay items en el carrito' });
  }
  try {
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: `http://localhost:${PORT}/pago-exitoso.html`,
      cancel_url: `http://localhost:${PORT}/pago-cancelado.html`,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la sesión de pago', details: error.message });
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