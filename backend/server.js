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
let currentToken = null;

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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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

// ========== AUTHENTICATION ==========
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  console.log('Login attempt with password:', password);
  if (password === ADMIN_PASSWORD) {
    currentToken = Date.now() + '-' + Math.random().toString(36).substring(2);
    console.log('Login successful, token generated:', currentToken);
    res.json({ success: true, token: currentToken });
  } else {
    console.log('Login failed: wrong password');
    res.status(401).json({ success: false });
  }
});

app.post('/api/admin/logout', (req, res) => {
  currentToken = null;
  res.json({ success: true });
});

function isAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('Authorization header received:', authHeader);
  if (authHeader && authHeader === `Bearer ${currentToken}`) {
    console.log('Token matches, authorized');
    return next();
  }
  console.log('Unauthorized: token mismatch or missing');
  res.status(403).json({ error: 'Unauthorized' });
}

// Debug endpoint
app.get('/api/debug-token', (req, res) => {
  res.json({ 
    received: req.headers.authorization, 
    expected: currentToken ? `Bearer ${currentToken}` : null,
    isAdmin: !!currentToken
  });
});

// ========== SERVICE IMAGES ==========
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
  const serviceName = decodeURIComponent(req.params.serviceName);
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const data = readData();
  const old = data.serviceImages[serviceName];
  if (old) {
    const oldPath = path.join(uploadDir, old);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  data.serviceImages[serviceName] = req.file.filename;
  writeData(data);
  res.json({ success: true, url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` });
});

// ========== SITE IMAGES ==========
app.get('/api/site-images', (req, res) => {
  const data = readData();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    homeBackground: data.siteImages.homeBackground ? `${baseUrl}/uploads/${data.siteImages.homeBackground}` : null,
    aboutImage: data.siteImages.aboutImage ? `${baseUrl}/uploads/${data.siteImages.aboutImage}` : null
  });
});

app.post('/api/site-image/:type', isAdmin, upload.single('image'), (req, res) => {
  const type = req.params.type;
  if (type !== 'home' && type !== 'about') return res.status(400).json({ error: 'Invalid type' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const data = readData();
  const key = type === 'home' ? 'homeBackground' : 'aboutImage';
  const old = data.siteImages[key];
  if (old) {
    const oldPath = path.join(uploadDir, old);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  data.siteImages[key] = req.file.filename;
  writeData(data);
  res.json({ success: true, url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` });
});

app.delete('/api/site-image/:type', isAdmin, (req, res) => {
  const type = req.params.type;
  if (type !== 'home' && type !== 'about') return res.status(400).json({ error: 'Invalid type' });
  const data = readData();
  const key = type === 'home' ? 'homeBackground' : 'aboutImage';
  const old = data.siteImages[key];
  if (old) {
    const oldPath = path.join(uploadDir, old);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    data.siteImages[key] = null;
    writeData(data);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'No image to remove' });
  }
});

// ========== SOCIAL LINKS ==========
app.get('/api/social-links', (req, res) => {
  const data = readData();
  res.json(data.socialLinks);
});

app.post('/api/social-links', isAdmin, (req, res) => {
  const { whatsapp, facebook } = req.body;
  const data = readData();
  if (whatsapp) data.socialLinks.whatsapp = whatsapp;
  if (facebook) data.socialLinks.facebook = facebook;
  writeData(data);
  res.json({ success: true, socialLinks: data.socialLinks });
});

// ========== TEAM MEMBERS ==========
app.get('/api/team', (req, res) => {
  const data = readData();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const members = data.teamMembers.map(m => ({
    id: m.id,
    name: sanitizeString(m.name),
    profession: sanitizeString(m.profession),
    imageUrl: m.imageFilename ? `${baseUrl}/uploads/${m.imageFilename}` : null
  }));
  res.json(members);
});

app.post('/api/team', isAdmin, upload.single('image'), (req, res) => {
  const { name, profession } = req.body;
  if (!name || !profession) return res.status(400).json({ error: 'Name and profession required' });
  const data = readData();
  const newMember = {
    id: Date.now(),
    name: sanitizeString(name),
    profession: sanitizeString(profession),
    imageFilename: req.file ? req.file.filename : null
  };
  data.teamMembers.push(newMember);
  writeData(data);
  res.json({ success: true });
});

app.put('/api/team/:id', isAdmin, upload.single('image'), (req, res) => {
  const id = parseInt(req.params.id);
  const { name, profession } = req.body;
  const data = readData();
  const index = data.teamMembers.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  if (name) data.teamMembers[index].name = sanitizeString(name);
  if (profession) data.teamMembers[index].profession = sanitizeString(profession);
  if (req.file) {
    const old = data.teamMembers[index].imageFilename;
    if (old) {
      const oldPath = path.join(uploadDir, old);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    data.teamMembers[index].imageFilename = req.file.filename;
  }
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/team/:id', isAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const data = readData();
  const index = data.teamMembers.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const oldFile = data.teamMembers[index].imageFilename;
  if (oldFile) {
    const oldPath = path.join(uploadDir, oldFile);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  data.teamMembers.splice(index, 1);
  writeData(data);
  res.json({ success: true });
});

// ========== APPOINTMENTS ==========
app.get('/api/appointments', isAdmin, (req, res) => {
  const data = readData();
  res.json(data.appointments);
});

app.post('/api/appointments', (req, res) => {
  const { name, location, phone } = req.body;
  if (!name || !location || !phone) return res.status(400).json({ error: 'Missing fields' });
  const data = readData();
  const newAppointment = {
    id: Date.now(),
    name: sanitizeString(name),
    location: sanitizeString(location),
    phone: sanitizeString(phone),
    createdAt: new Date().toISOString()
  };
  data.appointments.unshift(newAppointment);
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/appointments/:id', isAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const data = readData();
  data.appointments = data.appointments.filter(a => a.id !== id);
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/appointments', isAdmin, (req, res) => {
  const data = readData();
  data.appointments = [];
  writeData(data);
  res.json({ success: true });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') return res.status(413).json({ error: 'File too large (max 5MB)' });
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));