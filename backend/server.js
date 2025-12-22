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

// --- CONFIGURACIÓN DE SESIÓN MEJORADA ---
// Se ha establecido secure: false para permitir cookies en HTTP y HTTPS
// independientemente del entorno (NODE_ENV), igual que en PullPilot.
app.use(session({
  name: 'easypages_sid',
  secret: finalSessionSecret,
  store: new FileStore({ path: './sessions', ttl: 86400, retries: 2 }),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true, 
    secure: false, // <--- CAMBIO APLICADO AQUÍ
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
      html = html.replace('', `<input type="hidden" name="_csrf" value="${req.csrfToken()}">`);
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

    const response = await axios.get(
      `${CF_API_URL}/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`, 
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
