# SimuVar — Sistema de Gestión y Análisis de Variables Aleatorias

Sistema web para registrar, gestionar y analizar variables aleatorias discretas y continuas, diseñado para facilitar proyectos de simulación.

## Características

- **Gestión de Usuarios**: Registro, inicio/cierre de sesión, roles (Administrador e Investigador)
- **Variables Aleatorias**: Crear, editar, eliminar y listar variables discretas o continuas
- **Recolección de Datos**: Ingreso manual, carga masiva por CSV/Excel, edición y eliminación de registros
- **Validación de Tipos**: Los valores decimales son rechazados automáticamente en variables discretas
- **Estadísticas Descriptivas**: Media, mediana, moda, desviación estándar, mínimo y máximo
- **Visualización**: Histogramas de distribución de frecuencias (Chart.js)
- **Exportación**: Descarga de datos en formato CSV y Excel (.xlsx)
- **Control de Acceso**: Solo el creador de una variable o un administrador pueden modificarla

---

## 🖥️ Uso en Localhost (Desarrollo Local)

### Prerrequisitos

- [Node.js](https://nodejs.org/) versión 18 o superior
- (Opcional) PostgreSQL instalado localmente

### Instalación

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd WebPage

# 2. Instalar dependencias
npm install
```

### Ejecución sin PostgreSQL (Base de datos simulada)

Si **no** tienes PostgreSQL instalado, el sistema funciona automáticamente con una base de datos local en archivo JSON (`mock_database.json`). No necesitas configurar nada adicional.

```bash
# Iniciar el servidor
node server.js
```

Verás en consola:

```
===================================================
⚠️  ATENCIÓN: No se detectaron credenciales de base de datos.
💡  Usando base de datos simulada en "mock_database.json"
===================================================
===================================================
 Servidor local de simulación iniciado con éxito.
 Navega a: http://localhost:3000
===================================================
```

Abre tu navegador en **http://localhost:3000** y listo.

> **Nota:** Los datos se guardan en el archivo `mock_database.json` en la raíz del proyecto. Si deseas reiniciar la base de datos, simplemente borra ese archivo o reemplaza su contenido por:
> ```json
> {"users":[],"variables":[],"data_records":[]}
> ```

### Ejecución con PostgreSQL Local

Si prefieres usar una base de datos PostgreSQL real:

```bash
# 1. Crear la base de datos
psql -U postgres -c "CREATE DATABASE simulacion_db;"

# 2. Ejecutar el esquema para crear las tablas
psql -U postgres -d simulacion_db -f schema.sql

# 3. Crear archivo de configuración
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=tu_contraseña
PGDATABASE=simulacion_db
PGPORT=5432

JWT_SECRET=una_clave_secreta_segura
PORT=3000
```

```bash
# 4. Iniciar el servidor
node server.js
```

### Uso de la Aplicación

1. Abre **http://localhost:3000** en tu navegador
2. Haz clic en **"Regístrate aquí"** para crear una cuenta
3. Completa usuario, contraseña y selecciona tu rol (Administrador o Investigador)
4. Una vez dentro, presiona el botón **"+"** en la barra lateral para crear tu primera variable
5. Selecciona la variable para ingresar datos, ver estadísticas y exportar reportes

---

## 🚀 Despliegue en Vercel

### Paso 1: Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "SimuVar - Sistema de variables aleatorias"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

### Paso 2: Importar en Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Conecta tu cuenta de GitHub
3. Selecciona el repositorio que acabas de subir
4. Haz clic en **"Deploy"**

### Paso 3: Configurar la Base de Datos PostgreSQL

Tienes varias opciones para la base de datos en producción:

#### Opción A: Vercel Postgres (Recomendada)

1. En el dashboard de Vercel, ve a tu proyecto → **Storage**
2. Haz clic en **"Create Database"** → selecciona **Postgres**
3. Sigue las instrucciones para crear la base de datos
4. Las variables de entorno se configuran automáticamente (`POSTGRES_URL`)

#### Opción B: Neon (neon.tech)

1. Crea una cuenta gratuita en [neon.tech](https://neon.tech)
2. Crea un nuevo proyecto y base de datos
3. Copia la cadena de conexión (connection string)
4. En Vercel, ve a **Settings → Environment Variables**
5. Agrega:
   - `POSTGRES_URL` = `postgresql://usuario:contraseña@host/database?sslmode=require`

#### Opción C: Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **Settings → Database** y copia la URI de conexión
3. En Vercel, agrega `POSTGRES_URL` con esa URI

### Paso 4: Crear las Tablas

Una vez configurada la base de datos, ejecuta el contenido de `schema.sql` en tu base de datos. Puedes hacerlo desde:

- **Vercel Postgres**: Pestaña "Query" en el panel de Storage
- **Neon**: SQL Editor en el dashboard
- **Supabase**: SQL Editor en el dashboard

Copia y pega el siguiente SQL:

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'investigador')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS variables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('discreta', 'continua')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_records (
    id SERIAL PRIMARY KEY,
    variable_id INTEGER REFERENCES variables(id) ON DELETE CASCADE,
    value NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_records_variable_id ON data_records(variable_id);
```

### Paso 5: Configurar Variables de Entorno

En Vercel → **Settings → Environment Variables**, agrega:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `POSTGRES_URL` | `postgresql://...` | Cadena de conexión a PostgreSQL (si no usas Vercel Postgres integrado) |
| `JWT_SECRET` | `una_clave_secreta_larga_y_aleatoria` | Clave para firmar tokens de autenticación |

> **Importante:** Genera un `JWT_SECRET` seguro. Puedes usar este comando:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Paso 6: Redesplegar

Después de configurar las variables de entorno, haz un **redeploy** desde el dashboard de Vercel para que tome los cambios.

---

## 📁 Estructura del Proyecto

```
WebPage/
├── api/
│   ├── auth/
│   │   ├── helper.js        # Utilidades JWT (firmar/verificar tokens)
│   │   ├── login.js          # Endpoint de inicio de sesión
│   │   ├── me.js             # Endpoint de verificación de sesión
│   │   └── register.js       # Endpoint de registro de usuarios
│   ├── db.js                 # Conexión a PostgreSQL + fallback mock
│   ├── data.js               # CRUD de registros de datos
│   └── variables.js          # CRUD de variables aleatorias
├── index.html                # Interfaz principal (SPA)
├── style.css                 # Estilos (tema oscuro glassmorphism)
├── app.js                    # Lógica del frontend
├── server.js                 # Servidor Express para desarrollo local
├── schema.sql                # Esquema de base de datos PostgreSQL
├── vercel.json               # Configuración de despliegue Vercel
├── package.json              # Dependencias del proyecto
├── .env.example              # Plantilla de variables de entorno
└── .gitignore                # Archivos ignorados por Git
```

---

## 🛠️ Tecnologías Utilizadas

| Componente | Tecnología |
|------------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Backend | Node.js, Serverless Functions |
| Base de Datos | PostgreSQL |
| Autenticación | JWT (jsonwebtoken) + bcryptjs |
| Gráficos | Chart.js |
| Importación/Exportación | SheetJS (xlsx) |
| Hosting | Vercel |

---

## 📊 Funcionalidades por Módulo

### Usuarios
- Registro con selección de rol
- Inicio y cierre de sesión
- Persistencia de sesión con JWT

### Variables Aleatorias
- Crear variables discretas o continuas
- Editar nombre, descripción y tipo
- Eliminar variables (con cascada de datos)
- Búsqueda y filtrado en tiempo real

### Recolección de Datos
- Ingreso manual valor por valor
- Carga masiva desde archivos CSV o Excel
- Validación automática según tipo de variable
- Edición y eliminación individual de registros

### Análisis Estadístico
- Media aritmética (μ)
- Mediana
- Moda
- Desviación estándar muestral (σ)
- Valor mínimo y máximo
- Histograma de distribución de frecuencias

### Reportes y Exportación
- Exportar datos a CSV
- Exportar datos a Excel (.xlsx) con hoja de resumen estadístico
- Plantilla de ejemplo descargable para carga masiva
