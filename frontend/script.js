const API_BASE = 'https://retech-electrical.onrender.com';

const servicesList = [
  { name: "Electrical Installation", icon: "fa-bolt", desc: "Professional installation for residential & commercial properties." },
  { name: "Electrical Wiring", icon: "fa-plug", desc: "Complete wiring solutions for new builds & renovations." },
  { name: "Electrical Rewiring", icon: "fa-code-branch", desc: "Upgrade old wiring to modern standards." },
  { name: "Profile Strip Lights Installation", icon: "fa-lightbulb", desc: "Modern LED profile strip lighting." },
  { name: "Air Conditioning Installation & Services", icon: "fa-snowflake", desc: "AC installation, repairs & maintenance." },
  { name: "Domestic & Commercial Work", icon: "fa-building", desc: "Homes, offices, factories – full coverage." },
  { name: "Electrical Maintenance", icon: "fa-tools", desc: "Routine checks & troubleshooting." },
  { name: "Supply of Electrical Equipment", icon: "fa-boxes", desc: "Quality cables, breakers, panels & accessories." }
];

let serviceImages = {};
let adminLoggedIn = false;
let siteImages = { homeBackground: null, aboutImage: null };
let teamMembers = [];

async function apiCall(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ========== Services ==========
async function loadServiceImages() {
  try {
    const images = await apiCall('/api/service-images');
    serviceImages = images;
    renderServices();
  } catch (err) {
    console.error(err);
    document.getElementById('servicesGrid').innerHTML = '<div style="color:red;">Backend not running.</div>';
  }
}

function renderServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  grid.innerHTML = servicesList.map(service => {
    const imageUrl = serviceImages[service.name];
    const imgHtml = imageUrl
      ? `<img src="${imageUrl}" class="service-image" alt="${service.name}">`
      : `<div class="service-image-placeholder"><i class="fas fa-camera"></i> No image</div>`;
    return `
      <div class="service-card">
        <div class="service-icon"><i class="fas ${service.icon}"></i></div>
        <h3>${service.name}</h3>
        <p>${service.desc}</p>
        ${imgHtml}
        ${adminLoggedIn ? `<button class="upload-service-btn" data-service="${service.name}">📷 Upload</button>` : ''}
      </div>
    `;
  }).join('');

  if (adminLoggedIn) {
    document.querySelectorAll('.upload-service-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadImageForService(btn.dataset.service);
      });
    });
  }
}

async function uploadImageForService(serviceName) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(`${API_BASE}/api/service-image/${encodeURIComponent(serviceName)}`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        serviceImages[serviceName] = data.url;
        renderServices();
        alert('Image uploaded!');
      } else {
        alert('Upload failed. Make sure you are logged in as admin.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  input.click();
}

// ========== Site Images ==========
async function loadSiteImages() {
  try {
    const data = await apiCall('/api/site-images');
    siteImages = data;
    const hero = document.querySelector('.hero');
    if (hero && siteImages.homeBackground) {
      hero.style.backgroundImage = `linear-gradient(135deg, rgba(10,43,62,0.85), rgba(30,74,110,0.85)), url('${siteImages.homeBackground}')`;
    } else if (hero) {
      hero.style.backgroundImage = `linear-gradient(135deg, #0a2b3e, #1e4a6e)`;
    }
    const aboutImg = document.querySelector('.about-image img');
    if (aboutImg && siteImages.aboutImage) {
      aboutImg.src = siteImages.aboutImage;
    }
    if (adminLoggedIn) updateSiteImagePreviews();
  } catch (err) {
    console.error(err);
  }
}

function updateSiteImagePreviews() {
  const homePreview = document.getElementById('homeBgPreview');
  const aboutPreview = document.getElementById('aboutImagePreview');
  if (homePreview) {
    homePreview.innerHTML = siteImages.homeBackground ? `<img src="${siteImages.homeBackground}" class="image-preview">` : '<p>No background image set</p>';
  }
  if (aboutPreview) {
    aboutPreview.innerHTML = siteImages.aboutImage ? `<img src="${siteImages.aboutImage}" class="image-preview">` : '<p>No about image set</p>';
  }
}

async function uploadSiteImage(type) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(`${API_BASE}/api/site-image/${type}`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (type === 'home') siteImages.homeBackground = data.url;
        else siteImages.aboutImage = data.url;
        const hero = document.querySelector('.hero');
        if (type === 'home' && hero) {
          hero.style.backgroundImage = `linear-gradient(135deg, rgba(10,43,62,0.85), rgba(30,74,110,0.85)), url('${data.url}')`;
        }
        if (type === 'about') {
          const aboutImg = document.querySelector('.about-image img');
          if (aboutImg) aboutImg.src = data.url;
        }
        updateSiteImagePreviews();
        alert('Image updated!');
      } else {
        alert('Upload failed.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  input.click();
}

async function removeSiteImage(type) {
  if (!confirm(`Remove ${type === 'home' ? 'home background' : 'about'} image?`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/site-image/${type}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      if (type === 'home') siteImages.homeBackground = null;
      else siteImages.aboutImage = null;
      if (type === 'home') {
        const hero = document.querySelector('.hero');
        hero.style.backgroundImage = `linear-gradient(135deg, #0a2b3e, #1e4a6e)`;
      }
      if (type === 'about') {
        const aboutImg = document.querySelector('.about-image img');
        if (aboutImg) aboutImg.src = 'https://picsum.photos/id/104/500/400';
      }
      updateSiteImagePreviews();
      alert('Image removed');
    } else {
      alert('Removal failed');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ========== Social Links ==========
async function loadSocialLinks() {
  try {
    const res = await fetch(`${API_BASE}/api/social-links`, { credentials: 'include' });
    if (res.ok) {
      const links = await res.json();
      updateSocialLinksUI(links);
    }
  } catch (err) {
    console.error('Failed to load social links', err);
  }
}

function updateSocialLinksUI(links) {
  const whatsappBtns = document.querySelectorAll('#heroWhatsappBtn, #contactWhatsappBtn');
  whatsappBtns.forEach(btn => { if (btn) btn.href = links.whatsapp; });
  const fbBtns = document.querySelectorAll('#contactFacebookBtn');
  fbBtns.forEach(btn => { if (btn) btn.href = links.facebook; });
  if (adminLoggedIn) {
    document.getElementById('adminWhatsappUrl').value = links.whatsapp;
    document.getElementById('adminFacebookUrl').value = links.facebook;
  }
}

async function saveSocialLinks() {
  const whatsapp = document.getElementById('adminWhatsappUrl').value.trim();
  const facebook = document.getElementById('adminFacebookUrl').value.trim();
  if (!whatsapp || !facebook) {
    alert('Both fields are required.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/social-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp, facebook }),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      updateSocialLinksUI(data.socialLinks);
      alert('Social links updated!');
    } else {
      alert('Update failed. Make sure you are admin.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ========== Team ==========
async function loadTeam() {
  try {
    const res = await fetch(`${API_BASE}/api/team`, { credentials: 'include' });
    if (res.ok) teamMembers = await res.json();
    else teamMembers = [];
    renderTeam();
    if (adminLoggedIn) renderTeamAdmin();
  } catch (err) {
    console.error(err);
    teamMembers = [];
    renderTeam();
  }
}

function renderTeam() {
  const container = document.getElementById('teamGrid');
  if (!container) return;
  if (teamMembers.length === 0) {
    container.innerHTML = '<p style="text-align:center;">Team members coming soon.</p>';
    return;
  }
  container.innerHTML = teamMembers.map(m => `
    <div class="team-card">
      ${m.imageUrl ? `<img src="${m.imageUrl}" alt="${m.name}">` : '<div style="height:250px; background:#e2e8f0; display:flex; align-items:center; justify-content:center;">📷 No photo</div>'}
      <h3>${escapeHtml(m.name)}</h3>
      <p>${escapeHtml(m.profession)}</p>
    </div>
  `).join('');
}

function renderTeamAdmin() {
  const container = document.getElementById('teamAdminList');
  if (!container) return;
  if (teamMembers.length === 0) {
    container.innerHTML = '<p>No team members yet. Click "Add Team Member".</p>';
    return;
  }
  container.innerHTML = teamMembers.map(m => `
    <div style="border-bottom:1px solid #ccc; padding:10px; display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
      ${m.imageUrl ? `<img src="${m.imageUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:50%;">` : '<div style="width:60px; height:60px; background:#ccc; border-radius:50%;"></div>'}
      <div><strong>${escapeHtml(m.name)}</strong><br>${escapeHtml(m.profession)}</div>
      <button class="edit-team-btn" data-id="${m.id}">✏️ Edit</button>
      <button class="delete-team-btn" data-id="${m.id}">🗑️ Delete</button>
    </div>
  `).join('');
  document.querySelectorAll('.edit-team-btn').forEach(btn => {
    btn.addEventListener('click', () => showTeamModal(parseInt(btn.dataset.id)));
  });
  document.querySelectorAll('.delete-team-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this team member?')) {
        await fetch(`${API_BASE}/api/team/${btn.dataset.id}`, { method: 'DELETE', credentials: 'include' });
        loadTeam();
      }
    });
  });
}

function showTeamModal(editId = null) {
  const member = editId ? teamMembers.find(m => m.id === editId) : null;
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '2000';
  modal.innerHTML = `
    <div style="background:white; padding:2rem; border-radius:24px; width:350px;">
      <h3>${member ? 'Edit Team Member' : 'Add Team Member'}</h3>
      <input type="text" id="teamName" placeholder="Name" style="width:100%; margin:10px 0; padding:8px;" value="${member ? escapeHtml(member.name) : ''}">
      <input type="text" id="teamProf" placeholder="Profession" style="width:100%; margin:10px 0; padding:8px;" value="${member ? escapeHtml(member.profession) : ''}">
      <input type="file" id="teamImage" accept="image/*" style="margin:10px 0;">
      ${member && member.imageUrl ? `<div><img src="${member.imageUrl}" style="width:80px; border-radius:8px;"></div>` : ''}
      <button id="saveTeamBtn" style="background:#eab308; border:none; padding:8px 16px; border-radius:40px; cursor:pointer;">Save</button>
      <button id="cancelTeamBtn" style="margin-left:10px;">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelTeamBtn').onclick = () => modal.remove();
  document.getElementById('saveTeamBtn').onclick = async () => {
    const name = document.getElementById('teamName').value.trim();
    const profession = document.getElementById('teamProf').value.trim();
    const fileInput = document.getElementById('teamImage');
    if (!name || !profession) {
      alert('Name and profession required');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('profession', profession);
    if (fileInput.files[0]) formData.append('image', fileInput.files[0]);
    
    const url = member ? `${API_BASE}/api/team/${member.id}` : `${API_BASE}/api/team`;
    const method = member ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData, credentials: 'include' });
    if (res.ok) {
      modal.remove();
      loadTeam();
    } else {
      alert('Failed to save team member');
    }
  };
}

// ========== Booking ==========
document.getElementById('submitBookingBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('apptName').value.trim();
  const location = document.getElementById('apptLocation').value.trim();
  const phone = document.getElementById('apptPhone').value.trim();
  const msgDiv = document.getElementById('bookingMessage');
  if (!name || !location || !phone) {
    msgDiv.innerHTML = '❌ All fields required.';
    msgDiv.style.color = '#fecaca';
    return;
  }
  msgDiv.innerHTML = '⏳ Submitting...';
  try {
    await apiCall('/api/appointments', { method: 'POST', body: JSON.stringify({ name, location, phone }) });
    msgDiv.innerHTML = '✅ Appointment booked! We will contact you.';
    msgDiv.style.color = '#bbf7d0';
    document.getElementById('apptName').value = '';
    document.getElementById('apptLocation').value = '';
    document.getElementById('apptPhone').value = '';
    setTimeout(() => msgDiv.innerHTML = '', 3000);
    if (adminLoggedIn) loadAdminAppointments();
  } catch (err) {
    msgDiv.innerHTML = '❌ Server error.';
    msgDiv.style.color = '#fecaca';
    console.error(err);
  }
});

// ========== Admin Appointments ==========
async function loadAdminAppointments() {
  try {
    const apts = await apiCall('/api/appointments');
    const container = document.getElementById('adminAppointmentsList');
    if (!container) return;
    if (apts.length === 0) {
      container.innerHTML = '<p>No bookings yet.</p>';
      return;
    }
    container.innerHTML = apts.map(apt => `
      <div class="appointment-item">
        <div><strong>${escapeHtml(apt.name)}</strong> | 📍 ${escapeHtml(apt.location)} | 📞 ${escapeHtml(apt.phone)}</div>
        <div><small>${new Date(apt.createdAt).toLocaleString()}</small>
        <button class="delete-apt-btn" data-id="${apt.id}"><i class="fas fa-trash-alt"></i></button></div>
      </div>
    `).join('');
    document.querySelectorAll('.delete-apt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this appointment?')) {
          await apiCall(`/api/appointments/${btn.dataset.id}`, { method: 'DELETE' });
          loadAdminAppointments();
        }
      });
    });
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('clearAllAppointmentsBtn')?.addEventListener('click', async () => {
  if (confirm('Delete ALL appointments?')) {
    await apiCall('/api/appointments', { method: 'DELETE' });
    loadAdminAppointments();
  }
});

// ========== Admin Login ==========
let clickCount = 0;
document.querySelector('footer')?.addEventListener('click', () => {
  clickCount++;
  setTimeout(() => clickCount = 0, 800);
  if (clickCount === 3) {
    const pwd = prompt('Admin password:');
    if (pwd === 'admin123') {
      loginAdmin();
    } else {
      alert('Wrong password');
    }
    clickCount = 0;
  }
});

async function loginAdmin() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      adminLoggedIn = true;
      document.getElementById('adminPanel').style.display = 'block';
      renderServices();
      loadAdminAppointments();
      await loadSiteImages();
      await loadTeam();
      await loadSocialLinks();
      attachSiteImageButtons();
      document.getElementById('addTeamMemberBtn').onclick = () => showTeamModal();
      document.getElementById('saveSocialLinksBtn').onclick = saveSocialLinks;
      document.getElementById('adminLogoutBtn').onclick = async () => {
        await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' });
        adminLoggedIn = false;
        document.getElementById('adminPanel').style.display = 'none';
        renderServices();
        alert('Logged out');
      };
    } else {
      alert('Login failed');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function attachSiteImageButtons() {
  const uploadHome = document.getElementById('uploadHomeBgBtn');
  const uploadAbout = document.getElementById('uploadAboutImageBtn');
  const removeHome = document.getElementById('removeHomeBgBtn');
  const removeAbout = document.getElementById('removeAboutImageBtn');
  if (uploadHome) uploadHome.onclick = () => uploadSiteImage('home');
  if (uploadAbout) uploadAbout.onclick = () => uploadSiteImage('about');
  if (removeHome) removeHome.onclick = () => removeSiteImage('home');
  if (removeAbout) removeAbout.onclick = () => removeSiteImage('about');
}

// Auto-check session
fetch(`${API_BASE}/api/appointments`, { credentials: 'include' })
  .then(res => {
    if (res.status !== 403) {
      adminLoggedIn = true;
      document.getElementById('adminPanel').style.display = 'block';
      renderServices();
      loadAdminAppointments();
      loadSiteImages();
      loadTeam();
      loadSocialLinks();
      attachSiteImageButtons();
      document.getElementById('addTeamMemberBtn').onclick = () => showTeamModal();
      document.getElementById('saveSocialLinksBtn').onclick = saveSocialLinks;
      document.getElementById('adminLogoutBtn').onclick = async () => {
        await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' });
        adminLoggedIn = false;
        document.getElementById('adminPanel').style.display = 'none';
        renderServices();
        alert('Logged out');
      };
    } else {
      loadTeam();
      loadSocialLinks();
    }
  })
  .catch(() => {
    loadTeam();
    loadSocialLinks();
  });

// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
hamburger?.addEventListener('click', () => navMenu.classList.toggle('active'));
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => navMenu.classList.remove('active'));
});

function escapeHtml(str) {
  return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
}

// Initial loads (public)
loadServiceImages();
loadSiteImages();
loadTeam();
loadSocialLinks();