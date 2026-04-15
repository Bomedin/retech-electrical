const API_BASE = 'https://retech-electrical.onrender.com'; // CHANGE to your actual Render URL

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
let testimonials = [];
let blogPosts = [];

// Helper: API call with token
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('adminToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers,
    ...options
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Helper: File upload with token
async function uploadWithToken(url, formData) {
  const token = localStorage.getItem('adminToken');
  if (!token) throw new Error('No token found');
  const headers = { 'Authorization': `Bearer ${token}` };
  const res = await fetch(url, { method: 'POST', body: formData, headers, credentials: 'include' });
  return res;
}

// ========== SERVICES ==========
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
      ? `<img src="${imageUrl}" class="service-image" style="width:100%; height:160px; object-fit:cover; border-radius:16px; margin-top:1rem;">`
      : `<div class="service-image-placeholder" style="width:100%; height:160px; background:#e2e8f0; border-radius:16px; display:flex; align-items:center; justify-content:center; margin-top:1rem;">📷 No image</div>`;
    return `
      <div class="service-card" style="position:relative; background:white; border-radius:24px; padding:1.5rem; box-shadow:0 8px 20px rgba(0,0,0,0.05);">
        <div class="service-icon" style="font-size:2.5rem; color:#eab308; margin-bottom:1rem;"><i class="fas ${service.icon}"></i></div>
        <h3>${service.name}</h3>
        <p>${service.desc}</p>
        ${imgHtml}
        ${adminLoggedIn ? `<button class="upload-service-btn" data-service="${service.name}" style="position:absolute; top:10px; right:10px; background:#eab308; border:none; border-radius:30px; padding:6px 12px; cursor:pointer;">📷 Upload</button>` : ''}
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
    const token = localStorage.getItem('adminToken');   // <-- get token
    if (!token) {
      alert('You are not logged in. Please login first.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/service-image/${encodeURIComponent(serviceName)}`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` },   // <-- send token
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        serviceImages[serviceName] = data.url;
        renderServices();
        alert('Image uploaded!');
      } else {
        const err = await res.text();
        alert('Upload failed: ' + err);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  input.click();
}

// ========== SITE IMAGES ==========
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
    if (aboutImg && siteImages.aboutImage) aboutImg.src = siteImages.aboutImage;
    if (adminLoggedIn) updateSiteImagePreviews();
  } catch (err) { console.error(err); }
}

function updateSiteImagePreviews() {
  const homePreview = document.getElementById('homeBgPreview');
  const aboutPreview = document.getElementById('aboutImagePreview');
  if (homePreview) homePreview.innerHTML = siteImages.homeBackground ? `<img src="${siteImages.homeBackground}" style="max-width:100px; border-radius:8px;">` : '<p>No background image set</p>';
  if (aboutPreview) aboutPreview.innerHTML = siteImages.aboutImage ? `<img src="${siteImages.aboutImage}" style="max-width:100px; border-radius:8px;">` : '<p>No about image set</p>';
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
      const res = await uploadWithToken(`${API_BASE}/api/site-image/${type}`, formData);
      if (res.ok) {
        const data = await res.json();
        if (type === 'home') siteImages.homeBackground = data.url;
        else siteImages.aboutImage = data.url;
        const hero = document.querySelector('.hero');
        if (type === 'home' && hero) hero.style.backgroundImage = `linear-gradient(135deg, rgba(10,43,62,0.85), rgba(30,74,110,0.85)), url('${data.url}')`;
        if (type === 'about') {
          const aboutImg = document.querySelector('.about-image img');
          if (aboutImg) aboutImg.src = data.url;
        }
        updateSiteImagePreviews();
        alert('Image updated!');
      } else alert('Upload failed.');
    } catch (err) { alert('Error: ' + err.message); }
  };
  input.click();
}

async function removeSiteImage(type) {
  if (!confirm(`Remove ${type === 'home' ? 'home background' : 'about'} image?`)) return;
  const token = localStorage.getItem('adminToken');
  const res = await fetch(`${API_BASE}/api/site-image/${type}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    credentials: 'include'
  });
  if (res.ok) {
    if (type === 'home') siteImages.homeBackground = null;
    else siteImages.aboutImage = null;
    if (type === 'home') {
      const hero = document.querySelector('.hero');
      hero.style.backgroundImage = `linear-gradient(135deg, #0a2b3e, #1e4a6e)`;
    } else {
      const aboutImg = document.querySelector('.about-image img');
      if (aboutImg) aboutImg.src = 'https://picsum.photos/id/104/500/400';
    }
    updateSiteImagePreviews();
    alert('Image removed');
  } else alert('Removal failed');
}

// ========== SOCIAL LINKS ==========
async function loadSocialLinks() {
  try {
    const res = await fetch(`${API_BASE}/api/social-links`, { credentials: 'include' });
    if (res.ok) {
      const links = await res.json();
      document.querySelectorAll('#heroWhatsappBtn, #contactWhatsappBtn').forEach(btn => { if (btn) btn.href = links.whatsapp; });
      document.querySelectorAll('#contactFacebookBtn').forEach(btn => { if (btn) btn.href = links.facebook; });
      if (adminLoggedIn) {
        document.getElementById('adminWhatsappUrl').value = links.whatsapp;
        document.getElementById('adminFacebookUrl').value = links.facebook;
      }
    }
  } catch (err) { console.error(err); }
}

async function saveSocialLinks() {
  const whatsapp = document.getElementById('adminWhatsappUrl').value.trim();
  const facebook = document.getElementById('adminFacebookUrl').value.trim();
  if (!whatsapp || !facebook) return alert('Both fields are required.');
  try {
    const res = await apiCall('/api/social-links', { method: 'POST', body: JSON.stringify({ whatsapp, facebook }) });
    document.querySelectorAll('#heroWhatsappBtn, #contactWhatsappBtn').forEach(btn => { if (btn) btn.href = res.socialLinks.whatsapp; });
    document.querySelectorAll('#contactFacebookBtn').forEach(btn => { if (btn) btn.href = res.socialLinks.facebook; });
    alert('Social links updated!');
  } catch (err) { alert('Update failed: ' + err.message); }
}

// ========== TEAM ==========
async function loadTeam() {
  try {
    const res = await fetch(`${API_BASE}/api/team`, { credentials: 'include' });
    teamMembers = res.ok ? await res.json() : [];
    renderTeam();
    if (adminLoggedIn) renderTeamAdmin();
  } catch (err) { console.error(err); teamMembers = []; renderTeam(); }
}

function renderTeam() {
  const container = document.getElementById('teamGrid');
  if (!container) return;
  if (teamMembers.length === 0) { container.innerHTML = '<p style="text-align:center;">Team members coming soon.</p>'; return; }
  container.innerHTML = teamMembers.map(m => `
    <div class="team-card" style="background:white; border-radius:24px; overflow:hidden; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
      ${m.imageUrl ? `<img src="${m.imageUrl}" style="width:100%; height:250px; object-fit:cover;">` : '<div style="height:250px; background:#e2e8f0; display:flex; align-items:center; justify-content:center;">📷 No photo</div>'}
      <h3>${escapeHtml(m.name)}</h3>
      <p style="color:#eab308;">${escapeHtml(m.profession)}</p>
    </div>
  `).join('');
}

function renderTeamAdmin() {
  const container = document.getElementById('teamAdminList');
  if (!container) return;
  if (teamMembers.length === 0) { container.innerHTML = '<p>No team members yet. Click "Add Team Member".</p>'; return; }
  container.innerHTML = teamMembers.map(m => `
    <div style="border-bottom:1px solid #ccc; padding:10px; display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
      ${m.imageUrl ? `<img src="${m.imageUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:50%;">` : '<div style="width:60px; height:60px; background:#ccc; border-radius:50%;"></div>'}
      <div><strong>${escapeHtml(m.name)}</strong><br>${escapeHtml(m.profession)}</div>
      <button class="edit-team-btn" data-id="${m.id}">✏️ Edit</button>
      <button class="delete-team-btn" data-id="${m.id}">🗑️ Delete</button>
    </div>
  `).join('');
  document.querySelectorAll('.edit-team-btn').forEach(btn => btn.addEventListener('click', () => showTeamModal(parseInt(btn.dataset.id))));
  document.querySelectorAll('.delete-team-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('Delete this team member?')) {
      const token = localStorage.getItem('adminToken');
      await fetch(`${API_BASE}/api/team/${btn.dataset.id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {}, credentials: 'include' });
      loadTeam();
    }
  }));
}

function showTeamModal(editId = null) {
  const member = editId ? teamMembers.find(m => m.id === editId) : null;
  const modal = document.createElement('div');
  modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
  modal.style.width = '100%'; modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)'; modal.style.display = 'flex';
  modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = '2000';
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
    if (!name || !profession) return alert('Name and profession required');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('profession', profession);
    if (fileInput.files[0]) formData.append('image', fileInput.files[0]);
    const token = localStorage.getItem('adminToken');
    const url = member ? `${API_BASE}/api/team/${member.id}` : `${API_BASE}/api/team`;
    const method = member ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData, headers: token ? { 'Authorization': `Bearer ${token}` } : {}, credentials: 'include' });
    if (res.ok) { modal.remove(); loadTeam(); }
    else alert('Failed to save team member');
  };
}

// ========== TESTIMONIALS ==========
async function loadTestimonials() {
  try {
    const res = await fetch(`${API_BASE}/api/testimonials`, { credentials: 'include' });
    testimonials = res.ok ? await res.json() : [];
    renderTestimonials();
    if (adminLoggedIn) renderTestimonialsAdmin();
  } catch (err) { console.error(err); testimonials = []; renderTestimonials(); }
}

function renderTestimonials() {
  const container = document.getElementById('testimonialsGrid');
  if (!container) return;
  if (testimonials.length === 0) {
    container.innerHTML = '<p style="text-align:center;">No testimonials yet. Be the first to leave a review!</p>';
    return;
  }
  container.innerHTML = testimonials.map(t => `
    <div class="testimonial-card">
      <div class="stars">${'★'.repeat(t.rating)}${'☆'.repeat(5-t.rating)}</div>
      <p>${escapeHtml(t.content)}</p>
      <h4>${escapeHtml(t.name)}</h4>
      <span>${escapeHtml(t.role)}</span>
    </div>
  `).join('');
}

function renderTestimonialsAdmin() {
  const container = document.getElementById('testimonialsAdminList');
  if (!container) return;
  if (testimonials.length === 0) {
    container.innerHTML = '<p>No testimonials yet. Click "Add Testimonial".</p>';
    return;
  }
  container.innerHTML = testimonials.map(t => `
    <div style="border-bottom:1px solid #ccc; padding:10px;">
      <div><strong>${escapeHtml(t.name)}</strong> (${escapeHtml(t.role)}) - ${t.rating}★</div>
      <div>${escapeHtml(t.content.substring(0, 100))}...</div>
      <button class="edit-testimonial-btn" data-id="${t.id}">✏️ Edit</button>
      <button class="delete-testimonial-btn" data-id="${t.id}">🗑️ Delete</button>
    </div>
  `).join('');
  document.querySelectorAll('.edit-testimonial-btn').forEach(btn => btn.addEventListener('click', () => showTestimonialModal(parseInt(btn.dataset.id))));
  document.querySelectorAll('.delete-testimonial-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('Delete this testimonial?')) {
      const token = localStorage.getItem('adminToken');
      await fetch(`${API_BASE}/api/testimonials/${btn.dataset.id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {}, credentials: 'include' });
      loadTestimonials();
    }
  }));
}

function showTestimonialModal(editId = null) {
  const existing = editId ? testimonials.find(t => t.id === editId) : null;
  const modal = document.createElement('div');
  modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
  modal.style.width = '100%'; modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)'; modal.style.display = 'flex';
  modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = '2000';
  modal.innerHTML = `
    <div style="background:white; padding:2rem; border-radius:24px; width:400px;">
      <h3>${existing ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
      <input type="text" id="testimonialName" placeholder="Name" style="width:100%; margin:10px 0; padding:8px;" value="${existing ? escapeHtml(existing.name) : ''}">
      <input type="text" id="testimonialRole" placeholder="Role (e.g., Business Owner)" style="width:100%; margin:10px 0; padding:8px;" value="${existing ? escapeHtml(existing.role) : ''}">
      <textarea id="testimonialContent" placeholder="Testimonial text" rows="4" style="width:100%; margin:10px 0; padding:8px;">${existing ? escapeHtml(existing.content) : ''}</textarea>
      <select id="testimonialRating" style="width:100%; margin:10px 0; padding:8px;">
        ${[5,4,3,2,1].map(r => `<option value="${r}" ${existing && existing.rating === r ? 'selected' : ''}>${r} stars</option>`).join('')}
      </select>
      <button id="saveTestimonialBtn" style="background:#eab308; border:none; padding:8px 16px; border-radius:40px; cursor:pointer;">Save</button>
      <button id="cancelTestimonialBtn" style="margin-left:10px;">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelTestimonialBtn').onclick = () => modal.remove();
  document.getElementById('saveTestimonialBtn').onclick = async () => {
    const name = document.getElementById('testimonialName').value.trim();
    const role = document.getElementById('testimonialRole').value.trim();
    const content = document.getElementById('testimonialContent').value.trim();
    const rating = parseInt(document.getElementById('testimonialRating').value);
    if (!name || !content) return alert('Name and content required');
    const token = localStorage.getItem('adminToken');
    const url = existing ? `${API_BASE}/api/testimonials/${existing.id}` : `${API_BASE}/api/testimonials`;
    const method = existing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, role, content, rating }),
      credentials: 'include'
    });
    if (res.ok) {
      modal.remove();
      loadTestimonials();
    } else alert('Failed to save testimonial');
  };
}

// ========== BLOG POSTS ==========
async function loadBlogPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/blog`, { credentials: 'include' });
    blogPosts = res.ok ? await res.json() : [];
    renderBlogPosts();
    if (adminLoggedIn) renderBlogAdmin();
  } catch (err) { console.error(err); blogPosts = []; renderBlogPosts(); }
}

function renderBlogPosts() {
  const container = document.getElementById('blogGrid');
  if (!container) return;
  if (blogPosts.length === 0) {
    container.innerHTML = '<p style="text-align:center;">No blog posts yet. Check back soon!</p>';
    return;
  }
  container.innerHTML = blogPosts.map(post => `
    <div class="blog-card">
      ${post.imageUrl ? `<img src="${post.imageUrl}" style="width:100%; height:200px; object-fit:cover; border-radius:16px;">` : ''}
      <h3>${escapeHtml(post.title)}</h3>
      <small>${escapeHtml(post.date)}</small>
      <p>${escapeHtml(post.summary)}</p>
      <button class="read-more-btn" data-id="${post.id}" style="background:#eab308; border:none; border-radius:40px; padding:5px 12px; cursor:pointer;">Read More</button>
    </div>
  `).join('');
  document.querySelectorAll('.read-more-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = blogPosts.find(p => p.id === parseInt(btn.dataset.id));
      if (post) showBlogModal(post);
    });
  });
}

function showBlogModal(post) {
  const modal = document.createElement('div');
  modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
  modal.style.width = '100%'; modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.8)'; modal.style.display = 'flex';
  modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = '2000';
  modal.innerHTML = `
    <div style="background:white; padding:2rem; border-radius:24px; max-width:600px; max-height:80%; overflow:auto;">
      <h2>${escapeHtml(post.title)}</h2>
      <small>${escapeHtml(post.date)}</small>
      ${post.imageUrl ? `<img src="${post.imageUrl}" style="width:100%; margin:1rem 0; border-radius:16px;">` : ''}
      <div>${escapeHtml(post.content || post.summary)}</div>
      <button id="closeModalBtn" style="margin-top:1rem; background:#eab308; border:none; padding:8px 16px; border-radius:40px;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('closeModalBtn').onclick = () => modal.remove();
}

function renderBlogAdmin() {
  const container = document.getElementById('blogAdminList');
  if (!container) return;
  if (blogPosts.length === 0) {
    container.innerHTML = '<p>No blog posts yet. Click "Add Blog Post".</p>';
    return;
  }
  container.innerHTML = blogPosts.map(post => `
    <div style="border-bottom:1px solid #ccc; padding:10px;">
      <div><strong>${escapeHtml(post.title)}</strong> (${escapeHtml(post.date)})</div>
      <div>${escapeHtml(post.summary.substring(0, 80))}...</div>
      <button class="edit-blog-btn" data-id="${post.id}">✏️ Edit</button>
      <button class="delete-blog-btn" data-id="${post.id}">🗑️ Delete</button>
    </div>
  `).join('');
  document.querySelectorAll('.edit-blog-btn').forEach(btn => btn.addEventListener('click', () => showBlogModalAdmin(parseInt(btn.dataset.id))));
  document.querySelectorAll('.delete-blog-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('Delete this blog post?')) {
      const token = localStorage.getItem('adminToken');
      await fetch(`${API_BASE}/api/blog/${btn.dataset.id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {}, credentials: 'include' });
      loadBlogPosts();
    }
  }));
}

function showBlogModalAdmin(editId = null) {
  const existing = editId ? blogPosts.find(p => p.id === editId) : null;
  const modal = document.createElement('div');
  modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
  modal.style.width = '100%'; modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)'; modal.style.display = 'flex';
  modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = '2000';
  modal.innerHTML = `
    <div style="background:white; padding:2rem; border-radius:24px; width:500px; max-height:80%; overflow:auto;">
      <h3>${existing ? 'Edit Blog Post' : 'Add Blog Post'}</h3>
      <input type="text" id="blogTitle" placeholder="Title" style="width:100%; margin:10px 0; padding:8px;" value="${existing ? escapeHtml(existing.title) : ''}">
      <input type="text" id="blogDate" placeholder="Date (YYYY-MM-DD)" style="width:100%; margin:10px 0; padding:8px;" value="${existing ? existing.date : new Date().toISOString().split('T')[0]}">
      <input type="text" id="blogImageUrl" placeholder="Image URL (optional)" style="width:100%; margin:10px 0; padding:8px;" value="${existing ? existing.imageUrl || '' : ''}">
      <textarea id="blogSummary" placeholder="Short summary" rows="2" style="width:100%; margin:10px 0; padding:8px;">${existing ? escapeHtml(existing.summary) : ''}</textarea>
      <textarea id="blogContent" placeholder="Full content (optional)" rows="5" style="width:100%; margin:10px 0; padding:8px;">${existing ? escapeHtml(existing.content || '') : ''}</textarea>
      <button id="saveBlogBtn" style="background:#eab308; border:none; padding:8px 16px; border-radius:40px; cursor:pointer;">Save</button>
      <button id="cancelBlogBtn" style="margin-left:10px;">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelBlogBtn').onclick = () => modal.remove();
  document.getElementById('saveBlogBtn').onclick = async () => {
    const title = document.getElementById('blogTitle').value.trim();
    const date = document.getElementById('blogDate').value.trim();
    const imageUrl = document.getElementById('blogImageUrl').value.trim();
    const summary = document.getElementById('blogSummary').value.trim();
    const content = document.getElementById('blogContent').value.trim();
    if (!title || !summary) return alert('Title and summary required');
    const token = localStorage.getItem('adminToken');
    const url = existing ? `${API_BASE}/api/blog/${existing.id}` : `${API_BASE}/api/blog`;
    const method = existing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title, date, imageUrl, summary, content }),
      credentials: 'include'
    });
    if (res.ok) {
      modal.remove();
      loadBlogPosts();
    } else alert('Failed to save blog post');
  };
}

// ========== BOOKING ==========
document.getElementById('submitBookingBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('apptName').value.trim();
  const location = document.getElementById('apptLocation').value.trim();
  const phone = document.getElementById('apptPhone').value.trim();
  const msgDiv = document.getElementById('bookingMessage');
  if (!name || !location || !phone) { msgDiv.innerHTML = '❌ All fields required.'; msgDiv.style.color = '#fecaca'; return; }
  msgDiv.innerHTML = '⏳ Submitting...';
  try {
    const res = await fetch(`${API_BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location, phone }),
      credentials: 'include'
    });
    if (res.ok) {
      msgDiv.innerHTML = '✅ Appointment booked! We will contact you.'; msgDiv.style.color = '#bbf7d0';
      document.getElementById('apptName').value = ''; document.getElementById('apptLocation').value = ''; document.getElementById('apptPhone').value = '';
      setTimeout(() => msgDiv.innerHTML = '', 3000);
      if (adminLoggedIn) loadAdminAppointments();
    } else throw new Error(await res.text());
  } catch (err) { msgDiv.innerHTML = '❌ Server error.'; msgDiv.style.color = '#fecaca'; console.error(err); }
});

// ========== ADMIN APPOINTMENTS ==========
async function loadAdminAppointments() {
  try {
    const apts = await apiCall('/api/appointments');
    const container = document.getElementById('adminAppointmentsList');
    if (!container) return;
    if (apts.length === 0) { container.innerHTML = '<p>No bookings yet.</p>'; return; }
    container.innerHTML = apts.map(apt => `
      <div class="appointment-item" style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding:0.7rem 0;">
        <div><strong>${escapeHtml(apt.name)}</strong> | 📍 ${escapeHtml(apt.location)} | 📞 ${escapeHtml(apt.phone)}</div>
        <div><small>${new Date(apt.createdAt).toLocaleString()}</small>
        <button class="delete-apt-btn" data-id="${apt.id}" style="background:none; border:none; color:#ef4444; cursor:pointer;">🗑️</button></div>
      </div>
    `).join('');
    document.querySelectorAll('.delete-apt-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (confirm('Delete this appointment?')) { await apiCall(`/api/appointments/${btn.dataset.id}`, { method: 'DELETE' }); loadAdminAppointments(); }
    }));
  } catch (err) { console.error(err); }
}
document.getElementById('clearAllAppointmentsBtn')?.addEventListener('click', async () => {
  if (confirm('Delete ALL appointments?')) { await apiCall('/api/appointments', { method: 'DELETE' }); loadAdminAppointments(); }
});

// ========== ADMIN LOGIN ==========
let clickCount = 0;
document.querySelector('footer')?.addEventListener('click', () => {
  clickCount++;
  setTimeout(() => clickCount = 0, 800);
  if (clickCount === 3) {
    const pwd = prompt('Admin password:');
    if (pwd) loginAdmin(pwd);
    clickCount = 0;
  }
});

async function loginAdmin(password) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('adminToken', data.token);
      adminLoggedIn = true;
      document.getElementById('adminPanel').style.display = 'block';
      // Load all data
      renderServices();
      loadAdminAppointments();
      attachSiteImageButtons();
      loadTeam();
      loadTestimonials();
      loadBlogPosts();
      loadSocialLinks();
      // Attach admin button events
      document.getElementById('adminLogoutBtn').onclick = async () => {
        await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' });
        localStorage.removeItem('adminToken');
        adminLoggedIn = false;
        document.getElementById('adminPanel').style.display = 'none';
        renderServices();
      };
      document.getElementById('addTeamMemberBtn').onclick = () => showTeamModal();
      document.getElementById('addTestimonialBtn').onclick = () => showTestimonialModal();
      document.getElementById('addBlogPostBtn').onclick = () => showBlogModalAdmin();
      document.getElementById('saveSocialLinksBtn').onclick = saveSocialLinks;
    } else alert('Wrong password');
  } catch (err) { alert('Login failed: ' + err.message); }
}

function attachSiteImageButtons() {
  document.getElementById('uploadHomeBgBtn').onclick = () => uploadSiteImage('home');
  document.getElementById('uploadAboutImageBtn').onclick = () => uploadSiteImage('about');
  document.getElementById('removeHomeBgBtn').onclick = () => removeSiteImage('home');
  document.getElementById('removeAboutImageBtn').onclick = () => removeSiteImage('about');
}

// Auto-check token on page load
const savedToken = localStorage.getItem('adminToken');
if (savedToken) {
  fetch(`${API_BASE}/api/appointments`, { headers: { 'Authorization': `Bearer ${savedToken}` }, credentials: 'include' })
    .then(res => {
      if (res.status !== 403) {
        adminLoggedIn = true;
        document.getElementById('adminPanel').style.display = 'block';
        renderServices();
        loadAdminAppointments();
        attachSiteImageButtons();
        loadTeam();
        loadTestimonials();
        loadBlogPosts();
        loadSocialLinks();
        document.getElementById('adminLogoutBtn').onclick = async () => {
          await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' });
          localStorage.removeItem('adminToken');
          adminLoggedIn = false;
          document.getElementById('adminPanel').style.display = 'none';
          renderServices();
        };
        document.getElementById('addTeamMemberBtn').onclick = () => showTeamModal();
        document.getElementById('addTestimonialBtn').onclick = () => showTestimonialModal();
        document.getElementById('addBlogPostBtn').onclick = () => showBlogModalAdmin();
        document.getElementById('saveSocialLinksBtn').onclick = saveSocialLinks;
      } else localStorage.removeItem('adminToken');
    }).catch(() => localStorage.removeItem('adminToken'));
}

// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
hamburger?.addEventListener('click', () => navMenu.classList.toggle('active'));
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => navMenu.classList.remove('active')));

function escapeHtml(str) { return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }

// Initial loads (public)
loadServiceImages();
loadSiteImages();
loadTeam();
loadTestimonials();
loadBlogPosts();
loadSocialLinks();