# E-TARGET — App de Detección de Impactos (PWA)

Aplicación web progresiva (PWA) táctica para detección de impactos en blanco de tiro en tiempo real, con cámara + OpenCV.js, historial, desafíos, calculadora balística, ranking y panel de administración.

---

## 🌐 Deploy 100% desde el navegador (sin instalar NADA)

Esta guía te muestra cómo poner la app online usando **solo el navegador web**. No necesitás instalar Node, Bun, git, ni ningún CLI en tu PC. Todo se hace desde páginas web.

Usaremos 3 servicios gratuitos:
- **GitHub** — para guardar el código
- **Turso** — base de datos SQLite en la nube (gratis hasta 9GB)
- **Vercel** — hosting de la app (plan Hobby gratis)

---

### Paso 1: Crear base de datos vacía en Turso

1. Andá a **https://turso.tech** → "Get Started" → loguéate con GitHub o Google
2. Una vez dentro, click en **"New Database"**
3. Nombre: `e-target` → tipo: **SQLite** → click **"Create"**
4. Entrá a la DB que acabas de crear
5. Buscá la sección **"Settings"** o **"Connection"** y anotá dos cosas:
   - **URL** — algo como `libsql://e-target-<tu-usuario>.turso.io`
   - **Auth Token** — click en "Create token" si no tenés uno, copialo

> ✅ No hace falta crear tablas ni cargar datos a mano. La app lo hace sola en el Paso 4.

---

### Paso 2: Subir el código a GitHub

1. Descomprimí el zip `e-target.zip` en una carpeta en tu PC
2. Andá a **https://github.com** → loguéate (o creá cuenta gratis)
3. Click en **"+"** → **"New repository"**
4. Nombre: `e-target` → marcá **"Public"** → click **"Create repository"**
5. En la página del repo nuevo, click en **"uploading an existing file"**
6. **Arrastrá todos los archivos** descomprimidos a la zona de carga
   - Seleccioná TODO el contenido de la carpeta y arrastralo junto
   - GitHub sube varios archivos a la vez
7. Escribí un mensaje de commit (ej: "Initial commit") → click **"Commit changes"**

> ⚠️ No subas `node_modules/` ni `.next/` si están presentes (el zip ya las excluye).

---

### Paso 3: Deployar en Vercel

1. Andá a **https://vercel.com** → loguéate con GitHub (mismo usuario que usaste arriba)
2. Click en **"Add New"** → **"Project"**
3. Buscá tu repo `e-target` → click **"Import"**
4. Vercel detecta automáticamente que es Next.js. Solo tenés que agregar variables de entorno.
5. Abrí la sección **"Environment Variables"** y agregá estas 3:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `libsql://e-target-<tu-usuario>.turso.io` (la URL del Paso 1) |
   | `DATABASE_AUTH_TOKEN` | el token del Paso 1 |
   | `JWT_SECRET` | cualquier texto aleatorio largo (ej: `e-target-secret-2024-cambiar-32chars`) |

6. Click en **"Deploy"**
7. Esperá 1-2 minutos a que compile
8. ¡Listo! Vercel te da una URL pública tipo `https://e-target.vercel.app`

---

### Paso 4: Inicializar la base de datos (un solo clic)

Después del deploy, la base de datos está vacía. Para crear las tablas y cargar los datos demo automáticamente:

1. Abrí en el navegador: **`https://tu-app.vercel.app/api/setup`**
   (reemplazá `tu-app` por el nombre que te dio Vercel)
2. Vas a ver un JSON con el resultado. Buscá `"ok": true`
3. Si ves `"ok": true` — ¡todo listo! La DB tiene tablas + usuarios demo + planes.

> ✅ Este paso es **idempotente**: podés ejecutarlo las veces que quieras, no duplica datos.
> Si ves `"ok": false`, leé el campo `error` — suele ser un problema con las variables de entorno en Vercel.

**¿Qué hace `/api/setup`?**
- Crea las 6 tablas (`User`, `Session`, `Shot`, `SubscriptionPlan`, `UserSubscription`, `Payment`)
- Crea los índices
- Carga 4 planes de suscripción (GRATIS, PRO, CLUB, COMPETICIÓN)
- Crea el usuario admin (`admin@etarget.app` / `admin123`)
- Crea el usuario demo (`tirador@etarget.app` / `demo123`) con suscripción PRO activa

---

### Paso 5: ¡Probar la app!

Entrá a la URL que te dio Vercel y loguéate con:

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Admin** | `admin@etarget.app` | `admin123` |
| **Usuario** | `tirador@etarget.app` | `demo123` |

Para usar el scan con cámara real, abrí la URL desde el **celular** (Chrome/Safari) — la cámara funciona en el navegador del teléfono. Podés agregar la app a la pantalla de inicio ("Add to Home Screen") para que funcione como una app nativa.

---

## 📦 ¿Qué incluye el zip?

| Archivo/Carpeta | Descripción |
|-----------------|-------------|
| `src/` | Todo el código fuente de la app (frontend + API routes) |
| `src/app/api/setup/route.ts` | **Endpoint de inicialización** — visitá `/api/setup` para crear tablas + seed |
| `prisma/schema.prisma` | Esquema de la base de datos (6 modelos) |
| `public/logo1.png` | Logo de la app |
| `vercel.json` | Configuración de deploy para Vercel |
| `.env.example` | Template de variables de entorno |
| `README.md` | Este archivo |

---

## 🛠️ Desarrollo local (opcional — solo si querés programar)

Si en algún momento querés correr la app en tu PC para desarrollar o modificar:

```bash
bun install            # o: npm install
bun run db:push        # crea tablas en SQLite local
bun run db:seed        # carga datos demo
bun run dev            # inicia en http://localhost:3000
```

Necesitás instalar [Bun](https://bun.sh) o Node.js 20+. Pero **para solo deployar no hace falta** — seguí los Pasos 1-5 de arriba.

---

## 🗄️ Base de datos — Detalles

### Producción (Turso)
- **Servicio:** https://turso.tech
- **Tipo:** libSQL (fork de SQLite, 100% compatible)
- **Plan gratis:** 9GB storage, 1B lecturas/mes, 25M escrituras/mes
- **Configuración:** Variables `DATABASE_URL` y `DATABASE_AUTH_TOKEN` en Vercel
- **Inicialización:** Visitá `/api/setup` una vez después del deploy

### Local (desarrollo)
- **Archivo:** `db/custom.db` (SQLite)
- **Configuración:** `.env` con `DATABASE_URL=file:./db/custom.db`
- **Inicialización:** `bun run db:push && bun run db:seed`

### ¿Por qué Turso y no Postgres?
Turso usa libSQL (SQLite en la nube), así que **no hay que cambiar el código** — el mismo schema de Prisma funciona en ambos entornos. El archivo `src/lib/db.ts` detecta automáticamente si estás en local o producción.

### Esquema (6 tablas)

| Tabla | Descripción |
|-------|-------------|
| `User` | Usuarios (rol `user` o `admin`) |
| `Session` | Sesiones de tiro |
| `Shot` | Disparos individuales |
| `SubscriptionPlan` | Planes de suscripción |
| `UserSubscription` | Suscripciones activas |
| `Payment` | Pagos (MercadoPago) |

---

## 🎯 Scan — Calibración para polígono real

### ¿Cómo funciona?
OpenCV.js + frame-differencing a 12 FPS sobre frame downscaleado 480×270. Detecta blobs circulares nuevos entre frames y los registra como impactos.

### Condiciones para detección real
| Condición | Recomendación |
|-----------|---------------|
| Cámara estable | Trípode (la cámara no debe moverse) |
| Distancia cámara→blanco | 30–80 cm |
| Iluminación | Uniforme, sin cambios bruscos |
| Encuadre | Blanco completo visible con margen |
| Cadencia | Hasta 3 disparos/segundo |

### Último impacto siempre en ROJO
El impacto más reciente se muestra en `#ff3a28` con:
- Halo pulsante de doble anillo
- Borde más grueso (3px vs 1.5px)
- Badge con puntuación + texto "ÚLTIMO"

---

## 🛠️ Stack técnico

- **Framework:** Next.js 16 (App Router) + TypeScript 5
- **DB:** Prisma ORM + SQLite (local) / Turso libSQL (producción)
- **UI:** Tailwind CSS 4 + shadcn/ui + Lucide icons
- **Cámara:** OpenCV.js 4.8 (CDN) + WebRTC
- **Estado:** Zustand + TanStack Query
- **Auth:** JWT en cookie httpOnly
- **Deploy:** Vercel + Turso

---

## ❓ Preguntas frecuentes

**¿Necesito tarjeta de crédito para los servicios gratis?**
- GitHub: No
- Turso: No
- Vercel: No (el plan Hobby es gratis sin tarjeta)

**¿La app funciona offline?**
- Parcialmente. El PWA cachea la UI, pero la DB y el scan necesitan conexión.

**¿Puedo cambiar el logo?**
- Sí, reemplazá `public/logo1.png` por tu logo (mismo nombre) y subí el cambio a GitHub. Vercel redeploya automáticamente.

**¿Cómo reseteo la base de datos?**
- En Turso: entrá al panel → "Edit Data" → SQL Shell → ejecutá `DELETE FROM Shot; DELETE FROM Session; DELETE FROM User;` y volvé a visitar `/api/setup`.

**¿Puedo usar Postgres en vez de Turso?**
- Sí, pero necesitás cambiar el `schema.prisma` (`provider = "postgresql"`) y ajustar `db.ts`. Turso es más simple porque no requiere cambios.

**¿Qué hago si `/api/setup` da error?**
- Verificá que `DATABASE_URL` empiece con `libsql://` en Vercel → Settings → Environment Variables
- Verificá que `DATABASE_AUTH_TOKEN` esté correcto (copialo de nuevo desde Turso)
- Esperá 1-2 minutos si acabás de cambiar las variables y hace redeploy
