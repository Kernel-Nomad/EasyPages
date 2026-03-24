<p align="center">
  <img src="./public/logo.svg" alt="EasyPages" width="200"/>
</p>

<p align="center">
  <strong>
    <a href="#english">English</a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#español">Español</a>
  </strong>
</p>

<br>

<p align="center">
  <a href="https://github.com/Kernel-Nomad/EasyPages/stargazers">
    <img src="https://img.shields.io/github/stars/Kernel-Nomad/EasyPages?style=social" alt="GitHub stars"/>
  </a>
  &nbsp;
  <a href="https://github.com/Kernel-Nomad/EasyPages/issues">
    <img src="https://img.shields.io/github/issues/Kernel-Nomad/EasyPages" alt="GitHub issues"/>
  </a>
  &nbsp;
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/Kernel-Nomad/EasyPages" alt="License"/>
  </a>
  &nbsp;
  <img src="https://img.shields.io/github/last-commit/Kernel-Nomad/EasyPages" alt="Last commit"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white" alt="React + Vite"/>
  &nbsp;
  <img src="https://img.shields.io/badge/backend-Node.js%20%2B%20Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js + Express"/>
  &nbsp;
  <img src="https://img.shields.io/badge/style-TailwindCSS-38B2AC?logo=tailwindcss&logoColor=white" alt="TailwindCSS"/>
  &nbsp;
  <img src="https://img.shields.io/badge/infra-Docker-2496ED?logo=docker&logoColor=white" alt="Docker"/>
</p>

<p align="center">
  <img src="./public/dashboard.gif" alt="EasyPages dashboard">
</p>

<br>

<div id="english"></div>

# EasyPages

EasyPages is a self-hosted dashboard for managing Cloudflare Pages projects from your own server.

## What it does

- Lists Cloudflare Pages projects.
- Creates new Direct Upload projects.
- Triggers deployments and shows recent deployment history.
- Uploads ZIP bundles for Direct Upload projects.
- Adds and removes custom domains.
- Lets you edit the current build command and output directory.
- Ships with a bilingual UI (`es` / `en`).

## Requirements

- Docker + Docker Compose, or a local Node.js environment.
- A Cloudflare account with an API token that can edit Pages projects.

### Cloudflare token permissions

Create a custom Cloudflare API token with:

- `Account` → `Cloudflare Pages` → `Edit`

Token creation page: [Cloudflare Dashboard > My Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens)

## Quick install with Docker

1. Create a `.env` file in the project root using these variables:

   ```env
   CF_API_TOKEN=xxxxx
   CF_ACCOUNT_ID=xxxxx

   AUTH_USER=admin
   AUTH_PASS=password123

   SESSION_SECRET=2gcs1br2kf8dasjk8
   ```

2. Use the provided `docker-compose.yml`:

   ```yaml
   services:
     easypages:
       container_name: easypages
       image: ghcr.io/kernel-nomad/easypages
       restart: unless-stopped
       ports:
         - "8002:8002"
       env_file:
         - .env
       volumes:
         - ./sessions:/app/sessions
   ```

3. Start the container:

   ```bash
   docker compose pull
   docker compose up -d
   ```

4. Open [http://localhost:8002](http://localhost:8002).

## Local development

Install dependencies:

```bash
npm install
```

Create `.env` from the values above or from `.env.example`.

For a production-like local run, build the UI and start the server:

```bash
npm run build
npm run start
```

`npm run start` and `npm run dev` execute the canonical entrypoint at `src/index.js`. `server.js` remains available as a public compatibility shim for external tooling or manual invocations that still expect the repository-root entrypoint.

For active development:

- `npm run dev` starts the Express server in watch mode on port `8002`.
- `npm run dev:ui` starts Vite on port `5173` and proxies `/api`, `/login` and `/logout` to `http://localhost:8002`.

Validation commands:

```bash
npm test
npm run check
```

Notes:

- The server serves files from `dist/`, so `npm run build` is required before `npm run start`.
- If `SESSION_SECRET` is omitted, the server can generate and persist `.session_secret` locally.

## Repository layout

- `server.js`: public compatibility shim kept for external tooling and root-level entrypoint compatibility.
- `src/index.js`: canonical server entrypoint used by the package scripts.
- `src/api/`: HTTP server interface, route adapters, middleware and browser API client.
- `src/core/`: domain logic, Cloudflare integration, error factories and runtime bootstrapping.
- `src/core/cloudflare/`: shared Cloudflare API client.
- `src/core/projects/`: project validation, mapping and use cases.
- `src/core/deployments/`: deployment pagination, batch deletion and ZIP upload orchestration.
- `src/config/`: environment loading, runtime paths and upload limits without HTTP-layer concerns.
- `src/utils/`: shared pure helpers for files, ZIP handling and generic validation.
- `src/web/main.jsx`: React/Vite bootstrap.
- `src/web/app/`: shell, top-level hooks and layout orchestration.
- `src/web/features/`: feature views and project-specific components.
- `src/web/shared/`: shared i18n, layout, styles and generic UI.
- `public/`: static assets copied into the UI build.
- `tests/unit/`: unit suites split by layer (`api/`, `core/`, `utils/`).
- `tests/integration/`: integration suites for HTTP routers under `api/server/routes/`.
- `docs/`: project documentation such as structure notes.
- `scripts/`: repository scripts and placeholders for future automation.
- `.github/workflows/ghcr-publish.yml`: publishes the root Docker image to GHCR on release publication.

---

<div id="español"></div>

# EasyPages

EasyPages es un panel self-hosted para gestionar proyectos de Cloudflare Pages desde tu propio servidor.

## Qué hace

- Lista proyectos de Cloudflare Pages.
- Crea proyectos nuevos de tipo Direct Upload.
- Dispara despliegues y muestra el historial reciente.
- Sube paquetes ZIP para proyectos Direct Upload.
- Añade y elimina dominios personalizados.
- Permite editar el comando de build y el directorio de salida actuales.
- Incluye una UI bilingüe (`es` / `en`).

## Requisitos

- Docker y Docker Compose, o un entorno local con Node.js.
- Una cuenta de Cloudflare con un token API que pueda editar proyectos de Pages.

### Permisos del token de Cloudflare

Crea un token personalizado con:

- `Account` → `Cloudflare Pages` → `Edit`

Página de creación: [Cloudflare Dashboard > Mi Perfil > API Tokens](https://dash.cloudflare.com/profile/api-tokens)

## Instalación rápida con Docker

1. Crea un archivo `.env` en la raíz con estas variables:

   ```env
   CF_API_TOKEN=xxxxx
   CF_ACCOUNT_ID=xxxxx

   AUTH_USER=admin
   AUTH_PASS=password123

   SESSION_SECRET=2gcs1br2kf8dasjk8
   ```

2. Usa el `docker-compose.yml` incluido:

   ```yaml
   services:
     easypages:
       container_name: easypages
       image: ghcr.io/kernel-nomad/easypages
       restart: unless-stopped
       ports:
         - "8002:8002"
       env_file:
         - .env
       volumes:
         - ./sessions:/app/sessions
   ```

3. Inicia el contenedor:

   ```bash
   docker compose pull
   docker compose up -d
   ```

4. Abre [http://localhost:8002](http://localhost:8002).

## Desarrollo local

Instala dependencias:

```bash
npm install
```

Crea `.env` con los valores anteriores o a partir de `.env.example`.

Para una ejecución local similar a producción, genera la UI y arranca el servidor:

```bash
npm run build
npm run start
```

`npm run start` y `npm run dev` ejecutan el entrypoint canónico `src/index.js`. `server.js` se conserva como shim público de compatibilidad para tooling externo o invocaciones manuales que sigan esperando un entrypoint en la raíz.

Para desarrollo activo:

- `npm run dev` arranca el servidor Express en modo watch sobre el puerto `8002`.
- `npm run dev:ui` arranca Vite en el puerto `5173` y hace proxy de `/api`, `/login` y `/logout` hacia `http://localhost:8002`.

Comandos de validación:

```bash
npm test
npm run check
```

Notas:

- El servidor sirve archivos desde `dist/`, así que `npm run build` es necesario antes de `npm run start`.
- Si omites `SESSION_SECRET`, el servidor puede generar y persistir `.session_secret` localmente.

## Estructura del repositorio

- `server.js`: shim público de compatibilidad para tooling externo y compatibilidad con entrypoints en la raíz.
- `src/index.js`: entrypoint canónico del servidor usado por los scripts del paquete.
- `src/api/`: interfaz HTTP del servidor, adaptadores de rutas, middleware y cliente API del navegador.
- `src/core/`: lógica de dominio, integración con Cloudflare, factorías de error y arranque runtime.
- `src/core/cloudflare/`: cliente compartido de la API de Cloudflare.
- `src/core/projects/`: validación, mapeo y casos de uso de proyectos.
- `src/core/deployments/`: paginación de despliegues, borrado por lotes y orquestación de uploads ZIP.
- `src/config/`: carga de entorno, rutas de runtime y límites de upload sin dependencias de la capa HTTP.
- `src/utils/`: helpers puros compartidos para archivos, ZIP y validaciones genéricas.
- `src/web/main.jsx`: bootstrap de React/Vite.
- `src/web/app/`: shell, hooks de alto nivel y orquestación de layout.
- `src/web/features/`: views de feature y componentes específicos de proyectos.
- `src/web/shared/`: i18n, layout, estilos y UI genérica reutilizable.
- `public/`: assets estáticos copiados al build de la UI.
- `tests/unit/`: suites unitarias separadas por capa (`api/`, `core/`, `utils/`).
- `tests/integration/`: suites de integración de routers HTTP bajo `api/server/routes/`.
- `docs/`: documentación del proyecto, incluida la estructura.
- `scripts/`: scripts del repositorio y espacio reservado para automatizaciones futuras.
- `.github/workflows/ghcr-publish.yml`: publica la imagen Docker raíz en GHCR al publicar un release.
