require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';

// Configure Cloudinary with trimmed environment variables
if (USE_CLOUDINARY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
  });
  console.log('✅ Cloudinary configured');
  console.log('Cloud name:', cloudinary.config().cloud_name);
  console.log('API key present:', !!cloudinary.config().api_key);
  console.log('API secret present:', !!cloudinary.config().api_secret);
} else {
  console.log('⚠️ Cloudinary is disabled, using local file storage');
}

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

let currentToken = null;

const uploadDir = path.join(__dirname, 'uploads');
if (!USE_CLOUDINARY && !fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!USE_CLOUDINARY) app.use('/uploads', express.static(uploadDir));

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ========== SAVE IMAGE FUNCTION (fixed) ==========
async function saveImage(file, folder, req) {
  if (USE_CLOUDINARY) {
    console.log(`Uploading to Cloudinary (unsigned): ${folder}/${file.originalname}`);
    const uploadPreset = 'retech_unsigned'; // change to your preset name
    
    // Convert file buffer to base64 data URI
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;
    
    // Upload using unsigned preset (no signature required)
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(dataUri, {
        folder: folder,
        upload_preset: uploadPreset,
        resource_type: 'image'
      }, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          console.log('Cloudinary upload success:', result.secure_url);
          resolve(result.secure_url);
        }
      });
    });
  } else {
    // local fallback
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = unique + path.extname(file.originalname);
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  }
}

// Helper to delete old image from Cloudinary
async function deleteImageByUrl(url) {
  if (!USE_CLOUDINARY || !url) return;
  try {
    const parts = url.split('/');
    const filename = parts.pop().split('.')[0];
    const folder = parts[parts.length - 2];
    const publicId = `${folder}/${filename}`;
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Failed to delete old image', err);
  }
}

// ========== DATA PERSISTENCE ==========
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
      },
      testimonials: [],
      blogPosts: []
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
  if (req.body.password === ADMIN_PASSWORD) {
    currentToken = Date.now() + '-' + Math.random().toString(36).substring(2);
    res.json({ success: true, token: currentToken });
  } else res.status(401).json({ success: false });
});

app.post('/api/admin/logout', (req, res) => {
  currentToken = null;
  res.json({ success: true });
});

function isAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth === `Bearer ${currentToken}`) return next();
  res.status(403).json({ error: 'Unauthorized' });
}

// ========== SERVICE IMAGES ==========
app.get('/api/service-images', (req, res) => {
  const data = readData();
  res.json(data.serviceImages);
});

app.post('/api/service-image/:serviceName', isAdmin, upload.single('image'), async (req, res) => {
  const serviceName = decodeURIComponent(req.params.serviceName);
  console.log('Received upload request for service:', serviceName);
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const imageUrl = await saveImage(req.file, 'services', req);
    const data = readData();
    const oldUrl = data.serviceImages[serviceName];
    if (oldUrl && USE_CLOUDINARY) await deleteImageByUrl(oldUrl);
    data.serviceImages[serviceName] = imageUrl;
    writeData(data);
    res.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error('Upload error in route:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== SITE IMAGES ==========
app.get('/api/site-images', (req, res) => {
  const data = readData();
  res.json({
    homeBackground: data.siteImages.homeBackground,
    aboutImage: data.siteImages.aboutImage
  });
});

app.post('/api/site-image/:type', isAdmin, upload.single('image'), async (req, res) => {
  const type = req.params.type;
  if (type !== 'home' && type !== 'about') return res.status(400).json({ error: 'Invalid type' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const imageUrl = await saveImage(req.file, 'site', req);
    const data = readData();
    const key = type === 'home' ? 'homeBackground' : 'aboutImage';
    const oldUrl = data.siteImages[key];
    if (oldUrl && USE_CLOUDINARY) await deleteImageByUrl(oldUrl);
    data.siteImages[key] = imageUrl;
    writeData(data);
    res.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/site-image/:type', isAdmin, async (req, res) => {
  const type = req.params.type;
  if (type !== 'home' && type !== 'about') return res.status(400).json({ error: 'Invalid type' });
  const data = readData();
  const key = type === 'home' ? 'homeBackground' : 'aboutImage';
  const oldUrl = data.siteImages[key];
  if (oldUrl) {
    if (USE_CLOUDINARY) await deleteImageByUrl(oldUrl);
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

// ========== TEAM ==========
app.get('/api/team', (req, res) => {
  const data = readData();
  res.json(data.teamMembers);
});

app.post('/api/team', isAdmin, upload.single('image'), async (req, res) => {
  const { name, profession } = req.body;
  if (!name || !profession) return res.status(400).json({ error: 'Name and profession required' });
  const data = readData();
  let imageUrl = null;
  if (req.file) {
    imageUrl = await saveImage(req.file, 'team', req);
  }
  const newMember = {
    id: Date.now(),
    name: sanitizeString(name),
    profession: sanitizeString(profession),
    imageUrl
  };
  data.teamMembers.push(newMember);
  writeData(data);
  res.json({ success: true });
});

app.put('/api/team/:id', isAdmin, upload.single('image'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, profession } = req.body;
  const data = readData();
  const index = data.teamMembers.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  if (name) data.teamMembers[index].name = sanitizeString(name);
  if (profession) data.teamMembers[index].profession = sanitizeString(profession);
  if (req.file) {
    const oldUrl = data.teamMembers[index].imageUrl;
    if (oldUrl && USE_CLOUDINARY) await deleteImageByUrl(oldUrl);
    data.teamMembers[index].imageUrl = await saveImage(req.file, 'team', req);
  }
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/team/:id', isAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const data = readData();
  const index = data.teamMembers.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const oldUrl = data.teamMembers[index].imageUrl;
  if (oldUrl && USE_CLOUDINARY) await deleteImageByUrl(oldUrl);
  data.teamMembers.splice(index, 1);
  writeData(data);
  res.json({ success: true });
});

// ========== TESTIMONIALS ==========
app.get('/api/testimonials', (req, res) => {
  const data = readData();
  res.json(data.testimonials || []);
});

app.post('/api/testimonials', isAdmin, (req, res) => {
  const { name, role, content, rating } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  const data = readData();
  const newTestimonial = {
    id: Date.now(),
    name: sanitizeString(name),
    role: sanitizeString(role || 'Customer'),
    content: sanitizeString(content),
    rating: rating || 5,
    createdAt: new Date().toISOString()
  };
  data.testimonials.unshift(newTestimonial);
  writeData(data);
  res.json({ success: true });
});

app.put('/api/testimonials/:id', isAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, role, content, rating } = req.body;
  const data = readData();
  const index = data.testimonials.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  if (name) data.testimonials[index].name = sanitizeString(name);
  if (role !== undefined) data.testimonials[index].role = sanitizeString(role);
  if (content) data.testimonials[index].content = sanitizeString(content);
  if (rating) data.testimonials[index].rating = rating;
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/testimonials/:id', isAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const data = readData();
  data.testimonials = data.testimonials.filter(t => t.id !== id);
  writeData(data);
  res.json({ success: true });
});

// ========== BLOG POSTS ==========
app.get('/api/blog', (req, res) => {
  const data = readData();
  res.json(data.blogPosts || []);
});

app.post('/api/blog', isAdmin, (req, res) => {
  const { title, summary, content, imageUrl } = req.body;
  if (!title || !summary) return res.status(400).json({ error: 'Title and summary required' });
  const data = readData();
  const newPost = {
    id: Date.now(),
    title: sanitizeString(title),
    summary: sanitizeString(summary),
    content: content ? sanitizeString(content) : '',
    imageUrl: imageUrl || null,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  data.blogPosts.unshift(newPost);
  writeData(data);
  res.json({ success: true });
});

app.put('/api/blog/:id', isAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { title, summary, content, imageUrl, date } = req.body;
  const data = readData();
  const index = data.blogPosts.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  if (title) data.blogPosts[index].title = sanitizeString(title);
  if (summary) data.blogPosts[index].summary = sanitizeString(summary);
  if (content !== undefined) data.blogPosts[index].content = sanitizeString(content);
  if (imageUrl !== undefined) data.blogPosts[index].imageUrl = imageUrl;
  if (date) data.blogPosts[index].date = date;
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/blog/:id', isAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const data = readData();
  data.blogPosts = data.blogPosts.filter(p => p.id !== id);
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

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') return res.status(413).json({ error: 'File too large (max 5MB)' });
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));