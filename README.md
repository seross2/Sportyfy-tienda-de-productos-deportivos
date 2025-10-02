# Sportify Store - Tienda de Productos Deportivos

Bienvenido a Sportify Store, una aplicación web completa para una tienda de productos deportivos. Este proyecto incluye un backend con Node.js, una base de datos y autenticación con Supabase, y una pasarela de pagos integrada con Stripe.

## Características

- **Catálogo de Productos:** Visualización de productos cargados desde la base de datos.
- **Autenticación de Usuarios:** Registro e inicio de sesión de usuarios utilizando Supabase Auth.
- **Roles de Usuario:** Diferenciación entre usuarios normales y administradores.
- **Panel de Administrador:** Interfaz protegida para que los administradores puedan añadir nuevos productos a la tienda.
- **Carrito de Compras:** Funcionalidad para añadir productos al carrito (persistido en el navegador).
- **Pasarela de Pagos:** Integración con Stripe para procesar los pagos de forma segura.
- **Formulario de Contacto:** Envío de correos electrónicos a través de un endpoint en el backend.

## Tecnologías Utilizadas

- **Backend:** Node.js, Express.js
- **Base de Datos y Autenticación:** Supabase
- **Pagos:** Stripe
- **Envío de Correos:** Nodemailer
- **Frontend:** HTML5, CSS3, JavaScript (Vainilla)
- **Dependencias:** `dotenv`, `nodemon`

---

## 🚀 Guía de Instalación y Ejecución

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno local.

### Requisitos Previos

- **Node.js:** Asegúrate de tener instalada una versión reciente (v18.x o superior recomendada).
- **Git:** Necesario para clonar el repositorio.
- **Cuentas de Servicios:** Necesitarás cuentas en Supabase y Stripe para obtener las claves de API.

### 1. Clonar el Repositorio

Abre tu terminal y clona el proyecto en tu máquina.

```bash
git clone <URL_DEL_REPOSITORIO_GIT>
cd Sportyfy-tienda-de-productos-deportivos
```

### 2. Instalar Dependencias

Este comando instalará todas las librerías necesarias definidas en el archivo `package.json`.

```bash
npm install
```

### 3. Configurar Variables de Entorno

Este es el paso más importante para que la aplicación se conecte a los servicios externos.

1.  En la raíz del proyecto, encontrarás un archivo llamado `.env.example`.
2.  Crea una copia de este archivo y renómbrala a `.env`.
3.  Abre el nuevo archivo `.env` y rellena todos los valores con tus propias claves de Supabase, Stripe y la configuración de tu correo.

```ini
# Ejemplo de cómo debería quedar tu archivo .env
SUPABASE_URL="https://xxxxxxxx.supabase.co"
SUPABASE_ANON_KEY="eyJh..."
SUPABASE_SERVICE_KEY="eyJh..."
STRIPE_SECRET_KEY="sk_test_..."
EMAIL_USER="tu.correo@gmail.com"
EMAIL_PASS="tu_contraseña_de_aplicacion"
EMAIL_TO="correo_destino@ejemplo.com"
```

**¡Importante!** El archivo `.env` contiene información sensible y ya está incluido en `.gitignore` para que nunca se suba al repositorio.

### 4. Ejecutar la Aplicación

Una vez configurado todo, puedes iniciar el servidor.

**Para desarrollo (con reinicio automático al guardar cambios):**

```bash
npm run dev
```

**Para producción:**

```bash
npm start
```

¡Y listo! Abre tu navegador y visita **`http://localhost:3000`** para ver la tienda en funcionamiento.
