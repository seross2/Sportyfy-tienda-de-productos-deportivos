import express from 'express';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

dotenv.config(); // Carga el .env desde la raíz del proyecto

class Server {
    constructor() {
        this.app = express();
        this.port = 3000;
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        
        this.__filename = fileURLToPath(import.meta.url);
        this.__dirname = path.dirname(this.__filename);

        this.middlewares();
        this.routes();
    }

    middlewares() {
        // Webhook must be before json parser
        this.app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), this.handleStripeWebhook.bind(this));
        
        this.app.use(express.json());
        this.app.use(express.static(path.join(this.__dirname, '..', 'public')));
    }

    async authMiddleware(req, res, next) {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.log('Auth Middleware Error: Token no encontrado. Headers:', req.headers);
            return res.status(401).json({ error: 'No token provided. Unauthorized.' });
        }
        const { data: { user }, error } = await this.supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token. Unauthorized.' });
        }
        req.user = user;
        next();
    }

    async adminMiddleware(req, res, next) {
        const { data: profile, error } = await this.supabase
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
    }

    async handleStripeWebhook(req, res) {
        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        let event;

        try {
            event = this.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.log(`❌ Error message: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const id_pedido = session.metadata.id_pedido;

            try {
                await this.supabase.from('pedidos').update({ estado: 'Pagado' }).eq('id_pedido', id_pedido);
                await this.supabase.from('pagos').insert({
                    id_pedido: id_pedido,
                    monto: session.amount_total,
                    metodo: 'Stripe',
                    stripe_payment_id: session.payment_intent,
                    estado_pago: 'Completado'
                });
                await this.supabase.rpc('reducir_stock_pedido', { p_id_pedido: id_pedido });
            } catch (error) {
                console.error('Error al actualizar el pedido o registrar el pago:', error);
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
        res.json({ received: true });
    }

    routes() {
        const auth = this.authMiddleware.bind(this);
        const admin = this.adminMiddleware.bind(this);

        // Config
        this.app.get('/api/config', (req, res) => {
            res.json({
                supabaseUrl: process.env.SUPABASE_URL,
                supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
            });
        });

        // Products
        this.app.get('/api/products', async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = 12;
                const from = (page - 1) * limit;
                const to = from + limit - 1;

                const { search, id_categoria, id_marca, max_precio } = req.query;

                // CAMBIO: Ahora consultamos producto_variaciones para obtener stock y tallas
                let selectStatement = '*, marcas(nombre), producto_variaciones(stock, tallas(valor, categorias(nombre))), reseñas(puntuacion)';
                
                // Si se filtra por categoría, se necesita un inner join para asegurar que el producto pertenezca a ella.
                if (id_categoria) {
                    selectStatement = '*, marcas(nombre), producto_variaciones!inner(stock, tallas(valor, categorias!inner(nombre))), reseñas(puntuacion)';
                }

                let query = this.supabase.from('productos').select(selectStatement, { count: 'exact' });

                if (search) query = query.ilike('nombre', `%${search}%`);
                if (id_categoria) query = query.eq('producto_variaciones.tallas.categorias.id_categoria', id_categoria);
                if (id_marca) query = query.eq('id_marca', id_marca);
                if (max_precio) query = query.lte('precio', parseInt(max_precio));

                // Aplicar paginación
                query = query.range(from, to);
                const { data, error, count } = await query;
                if (error) throw error;

                const productsWithAvgRating = data.map(product => {
                    const reviews = product.reseñas || [];
                    const variaciones = product.producto_variaciones || [];
                    
                    // Calcular stock total sumando todas las variantes
                    const totalStock = variaciones.reduce((sum, v) => sum + v.stock, 0);
                    
                    // Obtener nombre de categoría de la primera variación encontrada (si existe)
                    const categoriaNombre = variaciones.length > 0 && variaciones[0].tallas && variaciones[0].tallas.categorias 
                        ? variaciones[0].tallas.categorias.nombre 
                        : 'Sin Categoría';

                    let average_rating = 0;
                    if (reviews.length > 0) {
                        const totalScore = reviews.reduce((acc, review) => acc + review.puntuacion, 0);
                        average_rating = totalScore / reviews.length;
                    }
                    return { ...product, stock: totalStock, category_name: categoriaNombre, average_rating };
                });

                res.json({ products: productsWithAvgRating, totalCount: count });
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener los productos', details: error.message });
            }
        });

        this.app.get('/api/products/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const { data, error } = await this.supabase
                    .from('productos')
                    .select('*, marcas(nombre), producto_variaciones(id_variacion, stock, tallas(id_talla, valor, categorias(nombre)))')
                    .eq('id_producto', id)
                    .single();

                if (error) throw error;
                if (!data) return res.status(404).json({ error: 'Producto no encontrado.' });
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener el producto', details: error.message });
            }
        });

        // Categories, Brands, Sizes
        this.app.get('/api/categorias', async (req, res) => {
            try {
                const { data, error } = await this.supabase.from('categorias').select('*');
                if (error) throw error;
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener las categorías', details: error.message });
            }
        });

        this.app.get('/api/marcas', async (req, res) => {
            try {
                const { data, error } = await this.supabase.from('marcas').select('*');
                if (error) throw error;
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener las marcas', details: error.message });
            }
        });

        this.app.get('/api/tallas', async (req, res) => {
            try {
                let query = this.supabase.from('tallas').select('*, categorias(nombre)');
                const { id_categoria } = req.query;

                if (id_categoria) {
                    query = query.eq('id_categoria', id_categoria);
                }
                const { data, error } = await query;
                if (error) throw error;
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener las tallas', details: error.message });
            }
        });

        // Admin Routes
        this.app.post('/api/products', auth, admin, async (req, res) => {
            try {
                const { nombre, descripcion, precio, imagen_url, id_marca, variaciones } = req.body;
                
                if (!nombre || !precio || !imagen_url) {
                    return res.status(400).json({ error: 'Nombre, precio e imagen son requeridos.' });
                }

                // 1. Insertar el producto base
                const { data, error } = await this.supabase
                    .from('productos')
                    .insert([{ nombre, descripcion, precio, imagen_url, id_marca }])
                    .select();
                
                if (error) throw error;
                const newProduct = data[0];

                // 2. Insertar las variaciones (tallas y stock)
                if (variaciones && variaciones.length > 0) {
                    const variacionesData = variaciones.map(v => ({ id_producto: newProduct.id_producto, id_talla: v.id_talla, stock: v.stock }));
                    const { error: varError } = await this.supabase.from('producto_variaciones').insert(variacionesData);
                    if (varError) throw varError;
                }

                if (error) throw error;
                res.status(201).json(newProduct);
            } catch (error) {
                res.status(500).json({ error: 'Error al añadir el producto', details: error.message });
            }
        });

        this.app.post('/api/categorias', auth, admin, async (req, res) => {
            const { nombre } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            try {
                const { data, error } = await this.supabase.from('categorias').insert({ nombre }).select();
                if (error) throw error;
                res.status(201).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al añadir la categoría', details: error.message });
            }
        });

        this.app.post('/api/marcas', auth, admin, async (req, res) => {
            const { nombre } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            try {
                const { data, error } = await this.supabase.from('marcas').insert({ nombre }).select();
                if (error) throw error;
                res.status(201).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al añadir la marca', details: error.message });
            }
        });

        this.app.post('/api/tallas', auth, admin, async (req, res) => {
            const { id_categoria, valor } = req.body;
            if (!id_categoria || !valor) return res.status(400).json({ error: 'Categoría y valor son requeridos.' });
            try {
                const { data, error } = await this.supabase.from('tallas').insert({ id_categoria, valor }).select();
                if (error) throw error;
                res.status(201).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al añadir la talla', details: error.message });
            }
        });

        this.app.put('/api/products/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            try {
                const { nombre, descripcion, precio, imagen_url, id_marca, variaciones } = req.body;
                
                if (!nombre || !precio || !imagen_url) {
                    return res.status(400).json({ error: 'Todos los campos principales son requeridos.' });
                }

                // 1. Actualizar producto base
                const { data, error } = await this.supabase
                    .from('productos')
                    .update({ nombre, descripcion, precio, imagen_url, id_marca })
                    .eq('id_producto', id)
                    .select();

                if (error) throw error;
                if (data.length === 0) return res.status(404).json({ error: 'Producto no encontrado para actualizar.' });

                // 2. Actualizar variaciones (Estrategia simple: Borrar anteriores e insertar nuevas)
                // Nota: En producción idealmente harías un "upsert", pero esto funciona para este alcance.
                await this.supabase.from('producto_variaciones').delete().eq('id_producto', id);
                
                if (variaciones && variaciones.length > 0) {
                    const variacionesData = variaciones.map(v => ({ id_producto: id, id_talla: v.id_talla, stock: v.stock }));
                    const { error: varError } = await this.supabase.from('producto_variaciones').insert(variacionesData);
                    if (varError) throw varError;
                }

                res.status(200).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al actualizar el producto', details: error.message });
            }
        });

        this.app.put('/api/categorias/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            const { nombre } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            try {
                const { data, error } = await this.supabase.from('categorias').update({ nombre }).eq('id_categoria', id).select();
                if (error) throw error;
                res.status(200).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al actualizar la categoría', details: error.message });
            }
        });

        this.app.put('/api/marcas/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            const { nombre } = req.body;
            if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });
            try {
                const { data, error } = await this.supabase.from('marcas').update({ nombre }).eq('id_marca', id).select();
                if (error) throw error;
                res.status(200).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al actualizar la marca', details: error.message });
            }
        });

        this.app.put('/api/tallas/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            const { id_categoria, valor } = req.body;
            if (!id_categoria || !valor) return res.status(400).json({ error: 'Categoría y valor son requeridos.' });
            try {
                const { data, error } = await this.supabase.from('tallas').update({ id_categoria, valor }).eq('id_talla', id).select();
                if (error) throw error;
                res.status(200).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al actualizar la talla', details: error.message });
            }
        });

        this.app.delete('/api/products/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            try {
                const { error } = await this.supabase.from('productos').delete().eq('id_producto', id);
                if (error) throw error;
                res.status(204).send();
            } catch (error) {
                res.status(500).json({ error: 'Error al eliminar el producto', details: error.message });
            }
        });

        this.app.delete('/api/categorias/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            try {
                const { error } = await this.supabase.from('categorias').delete().eq('id_categoria', id);
                if (error) throw error;
                res.status(204).send();
            } catch (error) {
                res.status(500).json({ error: 'Error al eliminar la categoría', details: error.message });
            }
        });

        this.app.delete('/api/marcas/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            try {
                const { error } = await this.supabase.from('marcas').delete().eq('id_marca', id);
                if (error) throw error;
                res.status(204).send();
            } catch (error) {
                res.status(500).json({ error: 'Error al eliminar la marca', details: error.message });
            }
        });

        this.app.delete('/api/tallas/:id', auth, admin, async (req, res) => {
            const { id } = req.params;
            try {
                const { error } = await this.supabase.from('tallas').delete().eq('id_talla', id);
                if (error) throw error;
                res.status(204).send();
            } catch (error) {
                res.status(500).json({ error: 'Error al eliminar la talla', details: error.message });
            }
        });

        // Reviews
        this.app.get('/api/reviews/:productId', async (req, res) => {
            const { productId } = req.params;
            try {
                const { data, error } = await this.supabase
                    .from('reseñas')
                    .select('*, profiles(username)')
                    .eq('id_producto', productId)
                    .order('fecha', { ascending: false });
                if (error) throw error;
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener las reseñas', details: error.message });
            }
        });

        this.app.post('/api/reviews', auth, async (req, res) => {
            const { id_producto, puntuacion, comentario } = req.body;
            const id_usuario = req.user.id;

            try {
                const { data: haComprado, error: rpcError } = await this.supabase
                    .rpc('usuario_compro_producto', {
                        p_id_usuario: id_usuario,
                        p_id_producto: id_producto
                    });

                if (rpcError) throw rpcError;

                if (!haComprado) {
                    return res.status(403).json({ error: 'Solo puedes dejar una reseña si has comprado este producto.' });
                }

                const { data, error } = await this.supabase.from('reseñas').insert([{ id_producto, id_usuario, puntuacion, comentario }]).select();
                if (error) return res.status(500).json({ error: 'Error al guardar la reseña', details: error.message });
                res.status(201).json(data[0]);
            } catch (error) {
                res.status(500).json({ error: 'Error al procesar la reseña', details: error.message });
            }
        });

        // Orders
        this.app.post('/api/orders', auth, async (req, res) => {
            const { items, direccion_envio, telefono_contacto, notas } = req.body;
            const id_usuario = req.user.id;

            if (!items || items.length === 0) return res.status(400).json({ error: 'No hay items en el carrito' });
            if (!direccion_envio || !telefono_contacto) return res.status(400).json({ error: 'La dirección y el teléfono son requeridos.' });

            try {
                const { data: pedido, error: pedidoError } = await this.supabase
                    .from('pedidos')
                    .insert({ id_usuario, estado: 'Pendiente' })
                    .select('id_pedido')
                    .single();

                if (pedidoError) throw pedidoError;

                const { error: envioError } = await this.supabase
                    .from('envios')
                    .insert({
                        id_pedido: pedido.id_pedido,
                        direccion: direccion_envio,
                        telefono: telefono_contacto,
                        notas: notas
                    });

                if (envioError) throw envioError;

                const detallesPedido = items.map(item => ({
                    id_pedido: pedido.id_pedido,
                    id_variacion: item.id_variacion, // CAMBIO: Ahora usamos id_variacion
                    cantidad: item.quantity,
                    precio_unitario: item.precio
                }));

                const { error: detalleError } = await this.supabase.from('pedido_detalle').insert(detallesPedido);
                if (detalleError) throw detalleError;

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

                const session = await this.stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: line_items,
                    mode: 'payment',
                    success_url: `http://localhost:${this.port}/pago-exitoso.html`,
                    cancel_url: `http://localhost:${this.port}/pago-cancelado.html`,
                    metadata: {
                        id_pedido: pedido.id_pedido,
                    }
                });

                res.json({ url: session.url });
            } catch (error) {
                console.error('--- ERROR DETALLADO AL CREAR PEDIDO ---');
                console.error(error);
                res.status(500).json({ error: 'Error al crear el pedido', details: error.message || 'Error desconocido en el servidor.' });
            }
        });

        this.app.get('/api/user/orders', auth, async (req, res) => {
            const id_usuario = req.user.id;
            try {
                const { data, error } = await this.supabase
                    .from('pedidos')
                    .select(`
                        *, 
                        envios(*), 
                        pedido_detalle(
                            *, 
                            producto_variaciones(
                                productos(nombre, imagen_url)
                            )
                        )
                    `)
                    .eq('id_usuario', id_usuario)
                    .order('fecha_pedido', { ascending: false });

                if (error) throw error;
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: 'Error al obtener el historial de pedidos', details: error.message });
            }
        });

        // Email
        this.app.post('/api/send-email', async (req, res) => {
            const { name, email, message } = req.body;

            if (!name || !email || !message) {
                return res.status(400).json({ error: 'Todos los campos son requeridos.' });
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const mailOptions = {
                from: `"${name}" <${email}>`,
                to: process.env.EMAIL_TO,
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
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log(`Servidor corriendo en http://localhost:${this.port}`);
        });
    }
}

const server = new Server();
server.listen();