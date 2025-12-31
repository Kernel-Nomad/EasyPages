import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv'; 
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import helmet from 'helmet';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';       
import FormData from 'form-data';  
import AdmZip from 'adm-zip';
import rateLimit from 'express-rate-limit';
import csurf from 'csurf';

const FileStore = sessionFileStore(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
    dotenv.config();
}

const PORT = process.env.PORT || 8002;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const { 
  CF_API_TOKEN, 
  CF_ACCOUNT_ID, 
  AUTH_USER, 
  AUTH_PASS 
} = process.env;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
  console.error("❌ ERROR CRÍTICO: Faltan variables de Cloudflare.");
}

const secretFilePath = path.join(__dirname, '.session_secret');
let finalSessionSecret = process.env.SESSION_SECRET;

if (!finalSessionSecret) {
  if (fs.existsSync(secretFilePath)) {
    try { finalSessionSecret = fs.readFileSync(secretFilePath, 'utf-8'); } catch (e) {}
  }
  if (!finalSessionSecret) {
    finalSessionSecret = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(secretFilePath, finalSessionSecret); } catch (e) {}
  }
}

const upload = multer({ dest: 'uploads/' });

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.cloudflare.com"],
      upgradeInsecureRequests: null,
    },
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'easypages_sid',
  secret: finalSessionSecret,
  store: new FileStore({ path: './sessions', ttl: 86400, retries: 2 }),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true, 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

const csrfProtection = csurf({ cookie: false });

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: "Límite de subidas excedido. Intente más tarde." },
    standardHeaders: true,
    legacyHeaders: false,
});

const createProjectLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Demasiadas solicitudes de creación de proyectos." },
    standardHeaders: true,
    legacyHeaders: false,
});


const isValidProjectName = (name) => {
    const regex = /^[a-z0-9-]+$/;
    return name && regex.test(name);
};

const isValidDomainName = (name) => {
    const regex = /^[a-zA-Z0-9.-]+$/;
    return name && regex.test(name) && !name.includes('..');
};

const safeUnlink = (filePath) => {
    if (!filePath) return;
    try {
        const normalizedPath = path.resolve(filePath);
        if (normalizedPath.startsWith(UPLOADS_DIR) && fs.existsSync(normalizedPath)) {
            fs.unlinkSync(normalizedPath);
        }
    } catch (e) {
        console.error("Error al eliminar archivo temporal:", e);
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requireAuth = (req, res, next) => {
  if (!AUTH_USER || !AUTH_PASS) return res.status(500).send("Error de configuración server-side.");
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api') || req.xhr) return res.status(401).json({ error: 'Sesión expirada' });
  res.redirect('/login');
};

app.get('/login', csrfProtection, (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  
  try {
      let html = fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8');
      const csrfField = `<input type="hidden" name="_csrf" value="${req.csrfToken()}">`;
      html = html.replace('<form action="/login" method="POST">', `<form action="/login" method="POST">${csrfField}`);
      res.send(html);
  } catch (e) {
      res.status(500).send("Error cargando login");
  }
});

app.post('/login', loginLimiter, csrfProtection, (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_USER && password === AUTH_PASS) {
    req.session.authenticated = true;
    req.session.user = username;
    return req.session.save(() => res.redirect('/'));
  }
  res.redirect('/login?error=1');
});

app.post('/logout', csrfProtection, (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

const CF_API_URL = 'https://api.cloudflare.com/client/v4';
const CF_HEADERS = {
  'Authorization': `Bearer ${CF_API_TOKEN}`,
  'Content-Type': 'application/json'
};

app.get('/api/csrf-token', requireAuth, csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.use('/api', requireAuth, csrfProtection);

app.get('/api/projects', async (req, res) => {
  try {
    const response = await axios.get(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects`, { headers: CF_HEADERS });
    const projects = response.data.result.map(p => ({
      id: p.id,
      name: p.name,
      subdomain: p.subdomain,
      source: p.source,
      latest_deployment: p.latest_deployment || { status: 'unknown' },
      build_config: p.build_config
    }));
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Error al conectar con Cloudflare' });
  }
});

app.get('/api/projects/:projectName/deployments', async (req, res) => {
  try {
    const { projectName } = req.params;
    if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

    // Obtenemos hasta 25 por defecto, pero podríamos paginar si quisiéramos más historial visible
    const response = await axios.get(
      `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments?per_page=25&sort_by=created_on&sort_order=desc`, 
      { headers: CF_HEADERS }
    );
    res.json(response.data.result);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching deployments' });
  }
});

app.post('/api/projects/:projectName/deployments', async (req, res) => {
    try {
        const { projectName } = req.params;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        const response = await axios.post(
            `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
            {}, { headers: CF_HEADERS }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Error triggering deployment' });
    }
});

// NUEVA RUTA: Borrar lista específica de deploys
app.delete('/api/projects/:projectName/deployments', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { deploymentIds } = req.body;

        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });
        if (!Array.isArray(deploymentIds) || deploymentIds.length === 0) {
            return res.status(400).json({ error: 'No se enviaron IDs para borrar' });
        }

        // Obtener deploy de producción para asegurar no borrarlo
        const projRes = await axios.get(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}`, { headers: CF_HEADERS });
        const productionId = projRes.data.result.canonical_deployment?.id;

        const results = { success: 0, failed: 0 };

        for (const id of deploymentIds) {
            if (id === productionId) {
                console.log(`Skipping production deployment: ${id}`);
                continue;
            }
            try {
                await axios.delete(
                    `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments/${id}`,
                    { headers: CF_HEADERS }
                );
                results.success++;
                await sleep(200); // Pequeña pausa para no saturar
            } catch (err) {
                console.error(`Error deleting ${id}:`, err.message);
                results.failed++;
            }
        }

        res.json({ message: 'Proceso completado', ...results });

    } catch (error) {
        console.error("Error bulk delete:", error);
        res.status(500).json({ error: 'Error procesando la eliminación' });
    }
});

// NUEVA RUTA: Borrar TODO el historial (Excepto Producción)
app.delete('/api/projects/:projectName/deployments/all', async (req, res) => {
    try {
        const { projectName } = req.params;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        // 1. Obtener ID de Producción
        const projRes = await axios.get(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}`, { headers: CF_HEADERS });
        const productionId = projRes.data.result.canonical_deployment?.id;
        
        console.log(`🗑️ Iniciando borrado total para ${projectName}. Producción (protegido): ${productionId}`);

        // 2. Recopilar TODOS los IDs (Paginación)
        let page = 1;
        let allIds = [];
        let keepFetching = true;

        while (keepFetching) {
            try {
                const depRes = await axios.get(
                    `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments?per_page=25&page=${page}`,
                    { headers: CF_HEADERS }
                );
                const deployments = depRes.data.result;
                
                if (!deployments || deployments.length === 0) {
                    keepFetching = false;
                } else {
                    const ids = deployments.map(d => d.id);
                    allIds = [...allIds, ...ids];
                    page++;
                    // Límite de seguridad para evitar loops infinitos si hay miles
                    if (page > 50) keepFetching = false; 
                }
            } catch (e) {
                console.error("Error fetching page " + page, e.message);
                keepFetching = false;
            }
        }

        // 3. Filtrar producción
        const idsToDelete = allIds.filter(id => id !== productionId);
        
        // 4. Borrar en bucle
        let deletedCount = 0;
        for (const id of idsToDelete) {
             try {
                await axios.delete(
                    `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments/${id}`,
                    { headers: CF_HEADERS }
                );
                deletedCount++;
                // Cloudflare rate limit protection
                await sleep(300); 
            } catch (err) {
                console.error(`Failed to delete ${id}`, err.message);
            }
        }

        res.json({ success: true, deleted: deletedCount, total_found: allIds.length });

    } catch (error) {
        console.error("Error delete ALL:", error);
        res.status(500).json({ error: 'Error crítico eliminando historial' });
    }
});


function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain',
        '.xml': 'application/xml',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip'
    };
    return types[ext] || 'application/octet-stream';
}

app.post('/api/projects/:projectName/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    const { projectName } = req.params;
    
    if (req.file) {
        const normalizedUploadPath = path.resolve(req.file.path);
        if (!normalizedUploadPath.startsWith(UPLOADS_DIR)) {
            console.error(`🚨 ALERTA DE SEGURIDAD: Intento de Path Traversal en upload: ${req.file.path}`);
            return res.status(403).json({ error: 'Ruta de archivo inválida.' });
        }
    }

    if (!isValidProjectName(projectName)) {
        if (req.file) safeUnlink(req.file.path);
        return res.status(400).json({ error: 'Nombre de proyecto inválido' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    try {
        console.log(`🚀 Iniciando despliegue para ${projectName}...`);

        const tokenRes = await axios.get(
            `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/upload-token`,
            { headers: CF_HEADERS }
        );
        const jwt = tokenRes.data.result.jwt;

        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();

        const filesToUpload = [];
        const manifest = {};

        const virtualRoot = '/safe/root';

        zipEntries.forEach(entry => {
            if (!entry.isDirectory) {
                const resolvedPath = path.resolve(virtualRoot, entry.entryName);
                
                if (!resolvedPath.startsWith(virtualRoot)) {
                    console.warn(`⚠️ Ignorando archivo malicioso (Zip Slip): ${entry.entryName}`);
                    return;
                }

                const content = entry.getData();
                const hash = crypto.createHash('md5').update(content).digest('hex');
                const b64 = content.toString('base64');
                
                let filePath = entry.entryName.replace(/\\/g, '/');
                if (!filePath.startsWith('/')) filePath = '/' + filePath;
                
                if (filePath.includes('/../') || filePath.includes('\\..\\')) {
                     return;
                }

                filesToUpload.push({
                    key: hash,
                    value: b64,
                    metadata: { contentType: getMimeType(filePath) },
                    base64: true
                });

                manifest[filePath] = hash;
            }
        });

        if (filesToUpload.length === 0) {
            throw new Error("El archivo ZIP está vacío, no contiene archivos válidos o seguros.");
        }

        await axios.post(
            `${CF_API_URL}/pages/assets/upload`,
            filesToUpload,
            { 
                headers: { 
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        const formData = new FormData();
        formData.append('manifest', JSON.stringify(manifest));

        await axios.post(
            `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
            formData,
            {
                headers: {
                    ...CF_HEADERS,
                    ...formData.getHeaders()
                }
            }
        );

        if (req.file) safeUnlink(req.file.path);
        res.json({ success: true, message: "Despliegue realizado correctamente" });

    } catch (error) {
        console.error("❌ Error en despliegue:", error.response?.data || error.message);
        if (req.file) safeUnlink(req.file.path);
        
        res.status(500).json({ 
            error: 'Error al procesar el despliegue en Cloudflare', 
            details: error.response?.data?.errors || error.message 
        });
    }
});

app.patch('/api/projects/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        const { build_config } = req.body;
        const cfBuildConfig = {};
        if (build_config) {
            if (build_config.command !== undefined) cfBuildConfig.build_command = build_config.command;
            if (build_config.output_dir !== undefined) cfBuildConfig.destination_dir = build_config.output_dir;
        }
        const response = await axios.patch(
            `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}`,
            { build_config: cfBuildConfig }, { headers: CF_HEADERS }
        );
        res.json(response.data.result);
    } catch (error) { res.status(500).json({ error: 'Error update' }); }
});

app.get('/api/projects/:projectName/domains', async (req, res) => {
    try {
        const { projectName } = req.params;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        const response = await axios.get(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/domains`, { headers: CF_HEADERS });
        res.json(response.data.result);
    } catch (error) { res.status(500).json({ error: 'Error domains' }); }
});

app.post('/api/projects/:projectName/domains', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { name } = req.body;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });
        if (!isValidDomainName(name)) return res.status(400).json({ error: 'Nombre de dominio inválido' });

        const response = await axios.post(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/domains`, { name }, { headers: CF_HEADERS });
        res.json(response.data.result);
    } catch (error) { res.status(500).json({ error: 'Error adding domain' }); }
});

app.delete('/api/projects/:projectName/domains/:domainName', async (req, res) => {
    try {
        const { projectName, domainName } = req.params;
        if (!isValidProjectName(projectName) || !isValidDomainName(domainName)) {
            return res.status(400).json({ error: 'Parámetros inválidos' });
        }

        await axios.delete(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/domains/${domainName}`, { headers: CF_HEADERS });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Error deleting domain' }); }
});

app.get('/api/projects/:projectName/env', async (req, res) => {
    try {
        const { projectName } = req.params;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        const response = await axios.get(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}`, { headers: CF_HEADERS });
        const result = response.data.result;
        const envs = result.deployment_configs?.production?.env || {};
        const simpleEnvs = {};
        Object.keys(envs).forEach(k => { simpleEnvs[k] = envs[k].value || ''; });
        
        res.json({ 
            env: simpleEnvs,
            build_config: { 
                command: result.build_config?.build_command || '', 
                output_dir: result.build_config?.destination_dir || '' 
            },
            production_branch: result.production_branch
        });
    } catch (error) { res.status(500).json({ error: 'Error settings' }); }
});

app.put('/api/projects/:projectName/env', async (req, res) => {
    try {
        const { projectName } = req.params;
        if (!isValidProjectName(projectName)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        const { env } = req.body;
        const formattedEnv = {};
        Object.keys(env).forEach(key => { formattedEnv[key] = { value: env[key] }; });
        const configBody = {
            deployment_configs: { production: { env: formattedEnv }, preview: { env: formattedEnv } }
        };
        await axios.patch(`${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}`, configBody, { headers: CF_HEADERS });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Error saving envs' }); }
});

app.post('/api/projects', createProjectLimiter, async (req, res) => {
    try {
        const { name } = req.body;
        if (!isValidProjectName(name)) return res.status(400).json({ error: 'Nombre de proyecto inválido' });

        const response = await axios.post(
            `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects`,
            { name, production_branch: "main" }, { headers: CF_HEADERS }
        );
        res.json(response.data.result);
    } catch (error) { res.status(500).json({ error: 'Error creating project' }); }
});

app.get('*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ EasyPages seguro corriendo en puerto ${PORT}`);
});