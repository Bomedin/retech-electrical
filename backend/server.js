require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// CORS – allow your Netlify domain
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Token storage (in-memory)
let adminToken = null;

// File upload setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only images are allowed'));
};
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

// Data file
const dataFile = path.join(__dirname, 'data.json');
function readData() {
  if (!fs.existsSync(dataFile)) {
    const defaultData = {
      serviceImages: {
        "Electrical Installation": null, "Electrical Wiring": null, "Electrical Rewiring": null,
        "Profile Strip Lights Installation": null, "Air Conditioning Installation & Services": null,
        "Domestic & Commercial Work": null, "Electrical Maintenance": null, "Supply of Electrical Equipment": null
      },
      appointments: [],
      siteImages: { homeBackground: null, aboutImage: null },
      teamMembers: [],
      socialLinks: {
        whatsapp: "https://wa.me/233265193861",
        facebook: "https://www.facebook.com/profile.php?id=100086465723456"
      }
    };
    fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(dataFile));
}
function writeData(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2)); }

function sanitizeString(str) {
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// Admin login (token)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  console.log('Login attempt with password:', password);
  if (password === ADMIN_PASSWORD) {
    adminToken = Date.now() + '-' + Math.random().toString(36).substring(2);
    console.log('Login successful, token generated:', adminToken);
    res.json({ success: true, token: adminToken });
  } else {
    console.log('Login failed: wrong password');
    res.status(401).json({ success: false });
  }
});

app.post('/api/admin/logout', (req, res) => {
  adminToken = null;
  res.json({ success: true });
});

function isAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('Authorization header received:', authHeader);
  if (authHeader && authHeader === `Bearer ${adminToken}`) {
    console.log('Token matches, authorized');
    return next();
  }
  console.log('Unauthorized: token mismatch or missing');
  res.status(403).json({ error: 'Unauthorized' });
}

// Debug endpoint (temporary, for testing)
app.get('/api/debug-token', (req, res) => {
  res.json({ 
    received: req.headers.authorization, 
    expected: currentToken ? `Bearer ${currentToken}` : null,
    isAdmin: !!currentToken
  });
});

// ========== API endpoints (with logging on protected routes) ==========
app.get('/api/service-images', (req, res) => {
  const data = readData();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = {};
  for (const [service, filename] of Object.entries(data.serviceImages)) {
    result[service] = filename ? `${baseUrl}/uploads/${filename}` : null;
  }
  res.json(result);
});

app.post('/api/service-image/:serviceName', isAdmin, upload.single('image'), (req, res) => {
  console.log('Upload request for service:', req.params.serviceName);
  if (!req.file) {
    console.log('No file received');
    return res.status(400).json({ error: 'No file' });
  }
  const serviceName = decodeURIComponent(req.params.serviceName);
  const data = readData();
  const old = data.serviceImages[serviceName];
  if (old) {
    const oldPath = path.join(uploadDir, old);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  data.serviceImages[serviceName] = req.file.filename;
  writeData(data);
  console.log('File saved:', req.file.filename);
  res.json({ success: true, url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` });
});

// Site images, team, appointments endpoints similarly protected (same as before)
// ... (I'll include them but for brevity assume they are identical to the previous token-based version)
// Since we already have the full token-based server.js, just ensure all protected routes use isAdmin.

// For brevity, I'll include the full server.js in the final answer.