# Guía de Contribución para Sportify Store

¡Gracias por tu interés en contribuir al proyecto! Para mantener el código organizado y facilitar la colaboración, seguimos un flujo de trabajo estándar basado en ramas y Pull Requests.

## Proceso de Contribución

Nunca subas cambios directamente a la rama `main`. En su lugar, sigue estos pasos:

### 1. Sincroniza tu Repositorio Local

Antes de empezar a trabajar, asegúrate de tener la versión más reciente del proyecto.

```bash
# Sitúate en la rama principal
git checkout main

# Descarga los últimos cambios del repositorio remoto
git pull origin main
```

### 2. Crea una Nueva Rama

Crea una rama nueva para trabajar en tu funcionalidad o corrección. Usa un nombre descriptivo.

**Formato recomendado:** `tipo/nombre-descriptivo`

- `feature/nombre-de-la-funcionalidad` (ej: `feature/editar-productos`)
- `fix/nombre-de-la-correccion` (ej: `fix/error-en-login`)

```bash
# Ejemplo para crear y situarse en una nueva rama para una nueva funcionalidad
git checkout -b feature/agregar-seccion-de-perfil
```

### 3. Realiza tus Cambios y Haz Commits

Trabaja en el código en tu nueva rama. Cuando tengas un conjunto de cambios lógicos, haz un commit.

```bash
# Añade los archivos que has modificado al "staging area"
git add .

# Crea el commit con un mensaje claro y descriptivo
git commit -m "feat: Agrega la sección de perfil de usuario"
```

### 4. Sube tus Cambios a GitHub

Cuando estés listo para que tus cambios sean revisados, sube tu rama al repositorio remoto en GitHub.

```bash
# La primera vez que subes la rama, usa el flag -u
git push -u origin feature/agregar-seccion-de-perfil
```

### 5. Crea un Pull Request (PR)

1.  Ve a la página del repositorio en GitHub.
2.  Verás una notificación para crear un **Pull Request** desde tu rama recién subida. Haz clic en ella.
3.  Asegúrate de que la rama base sea `main` y la rama a comparar (`compare`) sea la tuya.
4.  Escribe un título y una descripción clara de los cambios que hiciste.
5.  Haz clic en "Create Pull Request".

Un miembro del equipo revisará tus cambios, dejará comentarios si es necesario y, una vez aprobado, los integrará a la rama `main`. ¡Y eso es todo!
