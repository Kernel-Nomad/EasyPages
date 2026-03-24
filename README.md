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

> **Typical install (no git clone):** use the published **GHCR image** with `docker-compose.yml` and `.env` downloaded from this repo's raw URLs — see [Quick install with Docker](#quick-install-with-docker).

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

**Who this is for:** Most people run EasyPages from the **published container image** plus two local files: `docker-compose.yml` and `.env`. You do **not** need to clone the repository. The source tree is for development, customization, or security review.

**Required in `.env`:** `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `AUTH_USER`, `AUTH_PASS`.

Run in a new folder (default branch `main`; pin a [release tag](https://github.com/Kernel-Nomad/EasyPages/releases) in the URLs if you prefer):

```bash
mkdir easypages && cd easypages
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/Kernel-Nomad/EasyPages/main/docker-compose.yml
curl -fsSL -o .env.example https://raw.githubusercontent.com/Kernel-Nomad/EasyPages/main/.env.example
cp .env.example .env
# Edit .env: set CF_API_TOKEN, CF_ACCOUNT_ID, AUTH_USER, AUTH_PASS
docker compose up -d --pull always
```

Open [http://localhost:8002](http://localhost:8002).

The Compose file pins the image to a release tag on GHCR, sets `EASYPAGES_DATA_DIR` for one data volume, and includes a healthcheck (healthy when `/login` responds). Optional variables are listed in [`.env.example`](.env.example). With this setup, the data volume persists sessions and `.session_secret`, so you usually omit `SESSION_SECRET`. For other production setups without that directory, set `SESSION_SECRET` (see Notes below). Edge cases and older image tags: [CONTRIBUTING.md](CONTRIBUTING.md#releases-docker-image-and-compose).

**Alternative: install from a git clone**

If you already have the repo, use the same steps with the bundled [`docker-compose.yml`](docker-compose.yml) and [`.env.example`](.env.example) in the repository root instead of downloading the raw files.

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
- With `NODE_ENV=production`, set `SESSION_SECRET` unless you use `EASYPAGES_DATA_DIR` with a persistent volume (as in the bundled Docker Compose): then the app can create or reuse `.session_secret` under that directory. The GHCR image sets `NODE_ENV=production`. In development, if `SESSION_SECRET` is omitted, the server may generate and persist `.session_secret` in the repo root (warnings are logged if the file cannot be read or written).
- Session cookies use the `Secure` flag when `NODE_ENV=production` (HTTPS behind a reverse proxy with `trust proxy` enabled). Override with `SESSION_COOKIE_SECURE=true|false` if you must serve over plain HTTP in a production-marked environment.
- Sessions are stored on disk (`session-file-store` under `./sessions` by default, or under `<EASYPAGES_DATA_DIR>/sessions` when that variable is set). That fits a **single Node process**. If you run **multiple replicas** or processes behind a load balancer without sticky sessions, use one instance per deployment or switch to a shared session store (Redis, database, etc.); otherwise users will lose sessions unpredictably.
- Static UI files under `dist/` (`index.html`, `/assets/*`, etc.) are only served to **authenticated** browsers; login still loads `/login.css` and `/login-error.js` without a session.

For a full directory map of this repository (contributors), see [CONTRIBUTING.md — Repository layout](CONTRIBUTING.md#repository-layout).

---

<div id="español"></div>

# EasyPages

EasyPages es un panel self-hosted para gestionar proyectos de Cloudflare Pages desde tu propio servidor.

> **Instalación habitual (sin clonar):** usa la imagen publicada en **GHCR** con `docker-compose.yml` y `.env` descargados desde las URLs raw de este repo — véase [Instalación rápida con Docker](#docker-install-es).

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

<a id="docker-install-es"></a>

## Instalación rápida con Docker

**Para quién es:** La forma habitual de usar EasyPages es la **imagen publicada en el registro** más dos archivos en tu máquina: `docker-compose.yml` y `.env`. **No hace falta clonar el repositorio.** El código fuente sirve para desarrollo, personalización o auditoría.

**Obligatorio en `.env`:** `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `AUTH_USER`, `AUTH_PASS`.

Ejecuta en una carpeta nueva (rama por defecto `main`; puedes fijar un [tag de release](https://github.com/Kernel-Nomad/EasyPages/releases) en las URLs si lo prefieres):

```bash
mkdir easypages && cd easypages
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/Kernel-Nomad/EasyPages/main/docker-compose.yml
curl -fsSL -o .env.example https://raw.githubusercontent.com/Kernel-Nomad/EasyPages/main/.env.example
cp .env.example .env
# Edita .env: CF_API_TOKEN, CF_ACCOUNT_ID, AUTH_USER, AUTH_PASS
docker compose up -d --pull always
```

Abre [http://localhost:8002](http://localhost:8002).

El `docker-compose.yml` fija la imagen a un tag en GHCR, define `EASYPAGES_DATA_DIR` y un volumen de datos, e incluye un healthcheck (listo cuando responde `/login`). Variables opcionales: [`.env.example`](.env.example). Con este volumen persisten sesiones y `.session_secret`, así que normalmente puedes omitir `SESSION_SECRET`. Sin ese directorio de datos en producción, define `SESSION_SECRET` (véase Notas). Casos límite e imágenes antiguas: [CONTRIBUTING.md](CONTRIBUTING.md#releases-docker-image-and-compose).

**Alternativa: desde un clon del repositorio**

Si ya tienes el repo, usa los mismos pasos con el [`docker-compose.yml`](docker-compose.yml) y [`.env.example`](.env.example) de la raíz del proyecto en lugar de descargar los archivos en bruto.

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
- Con `NODE_ENV=production`, define `SESSION_SECRET` salvo que uses `EASYPAGES_DATA_DIR` con un volumen persistente (como en el Docker Compose del repo): entonces la app puede crear o reutilizar `.session_secret` en ese directorio. La imagen en GHCR define `NODE_ENV=production`. En desarrollo, si omites `SESSION_SECRET`, el servidor puede generar y persistir `.session_secret` en la raíz del repo (se registran avisos si no se puede leer o escribir el archivo).
- La cookie de sesión usa el flag `Secure` cuando `NODE_ENV=production` (HTTPS detrás de proxy con `trust proxy`). Puedes forzar el comportamiento con `SESSION_COOKIE_SECURE=true|false` si necesitas HTTP plano en un entorno marcado como production.
- Las sesiones se guardan en disco (`session-file-store` en `./sessions` por defecto, o en `<EASYPAGES_DATA_DIR>/sessions` si está definida la variable). Está pensado para **un solo proceso Node**. Si ejecutas **varias réplicas** o procesos detrás de un balanceador sin sticky sessions, usa una instancia por despliegue o un almacén de sesión compartido (Redis, base de datos, etc.); si no, los usuarios perderán la sesión de forma impredecible.
- Los estáticos de la UI en `dist/` (`index.html`, `/assets/*`, etc.) solo se sirven a navegadores **autenticados**; la pantalla de login sigue pudiendo cargar `/login.css` y `/login-error.js` sin sesión.

Mapa detallado del árbol del repositorio (contribuidores): [CONTRIBUTING.md — Repository layout](CONTRIBUTING.md#repository-layout).
