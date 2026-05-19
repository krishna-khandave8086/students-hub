// ===== STATE =====
let cameraStream = null;
let capturedImageBlob = null;
let activeCameraForm = 'lost';
let authToken = localStorage.getItem('authToken');
let currentStudentId = localStorage.getItem('studentId');
let currentUser = null;
let currentChatUser = null;
let chatPollInterval = null;

const API = '';

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  if (authToken && currentStudentId) {
    currentUser = currentStudentId;
    document.getElementById('welcome-msg').innerText = `Welcome, ${formatName(currentUser)}`;
    showPage('dashboard-page');
  } else {
    showPage('login-page');
  }
});

// ===== TOAST =====
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== PAGE NAV =====
function showPage(pageId) {
  ['login-page','dashboard-page','lost-found-page','buy-sell-page','profile-page','chat-page'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const page = document.getElementById(pageId);
  page.classList.remove('hidden');
  page.style.animation = 'none';
  page.offsetHeight; // trigger reflow
  page.style.animation = 'cardIn 0.5s cubic-bezier(0.16,1,0.3,1) both';

  if (pageId === 'lost-found-page') loadLostFound();
  if (pageId === 'buy-sell-page') loadMarketplace();
  if (pageId === 'profile-page') loadProfile();
  
  if (pageId === 'chat-page') {
    loadConversations();
  } else {
    // Stop polling if we leave chat page
    if (chatPollInterval) clearInterval(chatPollInterval);
  }
}

// ===== AUTH =====
function toggleAuth(mode) {
  const isRegister = mode === 'register';
  document.getElementById('auth-title').textContent = isRegister ? 'Create Account' : 'Students Hub';
  document.getElementById('auth-subtitle').textContent = isRegister ? 'Register with your college email' : 'Sign in with your student credentials';
  document.getElementById('auth-submit-btn').textContent = isRegister ? 'Create Account' : 'Login';
  document.getElementById('auth-form').dataset.mode = mode;
  document.getElementById('auth-toggle').innerHTML = isRegister
    ? 'Already have an account? <a onclick="toggleAuth(\'login\')">Sign In</a>'
    : 'New student? <a onclick="toggleAuth(\'register\')">Create Account</a>';
}

async function handleAuth(event) {
  event.preventDefault();
  const form = event.target;
  const mode = form.dataset.mode || 'login';
  const student_id = document.getElementById('college-id').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('auth-submit-btn');

  if (!student_id || !password) return showToast('Please fill all fields.', 'error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Please wait...';

  try {
    const res = await fetch(`${API}/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    authToken = data.token;
    currentUser = data.student_id;
    currentStudentId = data.student_id;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('studentId', currentStudentId);

    document.getElementById('welcome-msg').innerText = `Welcome, ${formatName(currentUser)}`;
    showPage('dashboard-page');
    showToast(data.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'register' ? 'Create Account' : 'Login';
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  currentStudentId = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('studentId');
  document.getElementById('college-id').value = '';
  document.getElementById('auth-password').value = '';
  toggleAuth('login');
  showPage('login-page');
  showToast('Signed out successfully.', 'info');
}

// ===== PROFILE PAGE =====
async function loadProfile() {
  const formattedName = formatName(currentStudentId);
  document.getElementById('profile-email').textContent = `${formattedName} (${currentStudentId})`;
  const list = document.getElementById('profile-posts-list');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading your posts...</p></div>';

  try {
    const [lfRes, mpRes] = await Promise.all([
      fetch(`${API}/api/lost-found/user`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API}/api/marketplace/user`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);
    const lfData = await lfRes.json();
    const mpData = await mpRes.json();

    const allPosts = [];
    lfData.forEach(p => allPosts.push({ ...p, source: 'lost-found' }));
    mpData.forEach(p => allPosts.push({ ...p, source: 'marketplace' }));

    allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (allPosts.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>You have no active posts.</p></div>';
      return;
    }

    list.innerHTML = allPosts.map((p, i) => {
      let badgeClass, title, detailsHtml;
      
      if (p.source === 'lost-found') {
        badgeClass = p.type === 'Lost' ? 'badge-lost' : 'badge-found';
        title = esc(p.item_name);
        detailsHtml = `
          <p class="location-text">📍 Location: ${esc(p.location)}</p>
          <p>${esc(p.details)}</p>
        `;
      } else {
        badgeClass = p.type === 'Selling' ? 'badge-selling' : 'badge-buying';
        title = esc(p.product_name);
        detailsHtml = `
          <p class="location-text">💰 Price: ${esc(p.price)}</p>
          <p><strong>Condition:</strong> ${esc(p.condition)}</p>
        `;
      }

      const imgBtn = p.image_path ? `<button type="button" class="view-img-btn" onclick="viewImage('${p.image_path}')">🖼️ View Image</button>` : '';
      const delBtn = `<button type="button" class="delete-own" onclick="deletePost('${p.source}',${p.id}, true)">🗑️ Delete Post</button>`;

      return `<div class="item-card" style="animation-delay:${i * 0.06}s">
        <span class="badge ${badgeClass}">${p.type}</span>
        <h4>${title}</h4>
        ${detailsHtml}
        ${imgBtn}
        <p class="timestamp">🕐 ${timeAgo(p.created_at)}</p>
        ${delBtn}
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><p>Failed to load profile posts.</p></div>';
  }
}

async function handleChangePassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const btn = event.target.querySelector('button[type="submit"]');

  if (!currentPassword || !newPassword) return showToast('Please fill all fields.', 'error');
  if (newPassword.length < 4) return showToast('New password must be at least 4 characters.', 'error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Updating...';

  try {
    const res = await fetch(`${API}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message, 'success');
    event.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Password';
  }
}

// ===== TIME AGO =====
function timeAgo(dateStr) {
  const now = new Date();
  const past = new Date(dateStr + 'Z');
  const diff = Math.floor((now - past) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return past.toLocaleDateString();
}

// ===== LOST & FOUND =====
async function loadLostFound() {
  const list = document.getElementById('lost-list');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const res = await fetch(`${API}/api/lost-found`);
    const posts = await res.json();
    if (posts.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No reports yet. Be the first to post!</p></div>';
      return;
    }
    list.innerHTML = posts.map((p, i) => {
      const isOwn = p.user_id === currentStudentId;
      const badgeClass = p.type === 'Lost' ? 'badge-lost' : 'badge-found';
      const prefix = p.type === 'Lost' ? 'Lost near' : 'Found near';
      const imgBtn = p.image_path ? `<button type="button" class="view-img-btn" onclick="viewImage('${p.image_path}')">🖼️ View Image</button>` : '';
      const delBtn = isOwn ? `<button type="button" class="delete-own" onclick="deletePost('lost-found',${p.id})">🗑️ Delete Post</button>` : '';
      const msgBtn = !isOwn ? `<button type="button" class="action-btn" style="padding:6px 12px; margin-top:8px; font-size:12px; display:block;" onclick="openChat('${p.user_id}')">💬 Message Student</button>` : '';

      return `<div class="item-card" style="animation-delay:${i * 0.06}s">
        <span class="badge ${badgeClass}">${p.type}</span>
        <h4>${esc(p.item_name)}</h4>
        <p class="location-text">📍 ${prefix}: ${esc(p.location)}</p>
        <p>${esc(p.details)}</p>
        ${imgBtn}
        ${msgBtn}
        <p class="timestamp">🕐 ${timeAgo(p.created_at)} • by ${esc(formatName(p.user_id))}</p>
        ${delBtn}
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Failed to load. Please try again.</p></div>';
  }
}

async function handleLostFoundPost(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const type = form.elements[0].value;
  const item_name = form.elements[1].value;
  const location = form.elements[2].value;
  const details = form.elements[3].value;

  if (!type || !item_name || !location || !details) return showToast('Please fill all fields.', 'error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Posting...';

  const formData = new FormData();
  formData.append('type', type);
  formData.append('item_name', item_name);
  formData.append('location', location);
  formData.append('details', details);
  if (capturedImageBlob) formData.append('image', capturedImageBlob, 'capture.png');

  try {
    const res = await fetch(`${API}/api/lost-found`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Report posted successfully!', 'success');
    form.reset();
    clearCapturedPhoto('lost');
    loadLostFound();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Report';
  }
}

// ===== MARKETPLACE =====
async function loadMarketplace() {
  const list = document.getElementById('market-list');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const res = await fetch(`${API}/api/marketplace`);
    const listings = await res.json();
    if (listings.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏪</div><p>No listings yet. Create the first one!</p></div>';
      return;
    }
    list.innerHTML = listings.map((p, i) => {
      const isOwn = p.user_id === currentStudentId;
      const badgeClass = p.type === 'Selling' ? 'badge-selling' : 'badge-buying';
      const imgBtn = p.image_path ? `<button type="button" class="view-img-btn" onclick="viewImage('${p.image_path}')">🖼️ View Image</button>` : '';
      const delBtn = isOwn ? `<button type="button" class="delete-own" onclick="deletePost('marketplace',${p.id})">🗑️ Delete Post</button>` : '';
      const msgBtn = !isOwn ? `<button type="button" class="action-btn" style="padding:6px 12px; margin-top:8px; font-size:12px; display:block;" onclick="openChat('${p.user_id}')">💬 Message Seller</button>` : '';

      return `<div class="item-card" style="animation-delay:${i * 0.06}s">
        <span class="badge ${badgeClass}">${p.type}</span>
        <h4>${esc(p.product_name)}</h4>
        <p class="location-text">💰 Price: ${esc(p.price)}</p>
        <p><strong>Condition:</strong> ${esc(p.condition)}</p>
        ${imgBtn}
        ${msgBtn}
        <p class="timestamp">🕐 ${timeAgo(p.created_at)} • by ${esc(formatName(p.user_id))}</p>
        ${delBtn}
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Failed to load. Please try again.</p></div>';
  }
}

async function handleMarketPost(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');

  const formData = new FormData();
  formData.append('type', form[0].value);
  formData.append('product_name', form[1].value);
  formData.append('condition', form[2].value);
  formData.append('price', form[3].value);

  const type = form[0].value;
  const product_name = form[1].value;
  const condition = form[2].value;
  const price = form[3].value;

  if (!type || !product_name || !condition || !price) return showToast('Please fill all fields.', 'error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Publishing...';

  const formData = new FormData();
  formData.append('type', type);
  formData.append('product_name', product_name);
  formData.append('condition', condition);
  formData.append('price', price);
  formData.append('contact', contact);
  if (capturedImageBlob) formData.append('image', capturedImageBlob, 'capture.png');

  try {
    const res = await fetch(`${API}/api/marketplace`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Listing published successfully!', 'success');
    form.reset();
    clearCapturedPhoto('market');
    loadMarketplace();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Listing';
  }
}

// ===== DELETE =====
async function deletePost(endpoint, id, fromProfile = false) {
  if (!confirm('Delete this post?')) return;
  try {
    const res = await fetch(`${API}/api/${endpoint}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Deleted successfully.', 'success');
    
    if (fromProfile) {
      loadProfile();
    } else {
      if (endpoint === 'lost-found') loadLostFound();
      else loadMarketplace();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== CHAT =====
function openChat(userId) {
  currentChatUser = userId;
  showPage('chat-page');
  loadConversations();
  loadChatMessages(userId);
}

async function loadConversations() {
  const list = document.getElementById('chat-sidebar-list');
  try {
    const res = await fetch(`${API}/api/messages/conversations`, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    
    // If we just clicked 'Message' on a new user not in our conversations yet, add them manually to the top
    if (currentChatUser && !data.includes(currentChatUser)) {
      data.unshift(currentChatUser);
    }

    if (data.length === 0) {
      list.innerHTML = '<div style="padding:16px; color:var(--text-muted); font-size:14px; text-align:center;">No conversations yet.</div>';
      return;
    }

    list.innerHTML = data.map(userId => `
      <div class="chat-contact ${userId === currentChatUser ? 'active' : ''}" onclick="loadChatMessages('${userId}')">
        <strong>${esc(formatName(userId))}</strong>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function loadChatMessages(otherUser) {
  currentChatUser = otherUser;
  document.getElementById('chat-header').textContent = `Chat with ${formatName(otherUser)}`;
  document.getElementById('chat-input').disabled = false;
  document.getElementById('chat-send-btn').disabled = false;
  
  // Highlight sidebar
  document.querySelectorAll('.chat-contact').forEach(el => el.classList.remove('active'));
  loadConversations(); // re-render sidebar to apply active class

  if (chatPollInterval) clearInterval(chatPollInterval);
  
  await fetchMessages();
  chatPollInterval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
}

async function fetchMessages() {
  if (!currentChatUser) return;
  const container = document.getElementById('chat-messages');
  // Simple hack to detect if user scrolled up, to avoid forcing them down
  const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

  try {
    const res = await fetch(`${API}/api/messages/${currentChatUser}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
    const messages = await res.json();

    if (messages.length === 0) {
      container.innerHTML = '<div style="margin:auto; color:var(--text-muted); font-size:14px;">No messages yet. Say hi!</div>';
      return;
    }

    container.innerHTML = messages.map(m => {
      const isSent = m.sender_id === currentStudentId;
      return `<div class="msg-bubble ${isSent ? 'sent' : 'received'}">${esc(m.content)}</div>`;
    }).join('');

    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleSendMessage(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !currentChatUser) return;

  input.value = '';
  // Optimistic UI update
  const container = document.getElementById('chat-messages');
  if (container.querySelector('.msg-bubble') === null) container.innerHTML = '';
  container.innerHTML += `<div class="msg-bubble sent">${esc(content)}</div>`;
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch(`${API}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ receiver_id: currentChatUser, content })
    });
    if (!res.ok) throw new Error('Failed to send');
    // We don't need to refetch immediately because polling handles it
  } catch (err) {
    showToast('Failed to send message.', 'error');
  }
}

// ===== CAMERA =====
function updateLocationPlaceholder() {
  const status = document.getElementById('report-type').value;
  const locInput = document.getElementById('location-input');
  const photoLabel = document.getElementById('photo-label');
  if (status === 'Lost') {
    locInput.placeholder = "Lost near or last seen near (e.g., Main Library)...";
    photoLabel.innerText = "Reference Photo of the Lost Item (Optional):";
  } else if (status === 'Found') {
    locInput.placeholder = "Found near (e.g., Canteen, Lab 3)...";
    photoLabel.innerText = "Photo of the Found Item (Optional):";
  } else {
    locInput.placeholder = "Where was it lost/found?";
    photoLabel.innerText = "Provide a Photo of the Item (Optional):";
  }
}

async function openCamera(formType = 'lost') {
  activeCameraForm = formType;
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-feed');
  modal.classList.remove('hidden');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = cameraStream;
  } catch (err) {
    showToast('Unable to access camera. Check permissions.', 'error');
    closeCamera();
  }
}

function closeCamera() {
  document.getElementById('camera-modal').classList.add('hidden');
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('camera-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    capturedImageBlob = blob;
    const url = URL.createObjectURL(blob);
    if (activeCameraForm === 'market') {
      document.getElementById('market-preview').src = url;
      document.getElementById('market-preview-container').classList.remove('hidden');
    } else {
      document.getElementById('captured-preview').src = url;
      document.getElementById('captured-preview-container').classList.remove('hidden');
    }
  }, 'image/png');

  closeCamera();
}

function clearCapturedPhoto(formType = 'lost') {
  capturedImageBlob = null;
  if (formType === 'market') {
    document.getElementById('market-preview-container').classList.add('hidden');
    document.getElementById('market-preview').src = '';
  } else {
    document.getElementById('captured-preview-container').classList.add('hidden');
    document.getElementById('captured-preview').src = '';
  }
}

// ===== IMAGE VIEWER =====
function viewImage(src) {
  document.getElementById('viewer-img').src = src;
  document.getElementById('image-viewer-modal').classList.remove('hidden');
}
function closeImageViewer() {
  document.getElementById('image-viewer-modal').classList.add('hidden');
  document.getElementById('viewer-img').src = '';
}

// ===== FILE PICKER =====
function triggerFilePicker(formType) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    capturedImageBlob = file;
    const url = URL.createObjectURL(file);
    if (formType === 'market') {
      document.getElementById('market-preview').src = url;
      document.getElementById('market-preview-container').classList.remove('hidden');
    } else {
      document.getElementById('captured-preview').src = url;
      document.getElementById('captured-preview-container').classList.remove('hidden');
    }
  };
  input.click();
}

// ===== HELPERS =====
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatName(email) {
  if (!email || !email.includes('@')) return email;
  const localPart = email.split('@')[0];
  
  // Try to match format: firstname.lastname_something
  const match = localPart.match(/^([a-zA-Z]+)\.([a-zA-Z]+)(_.*)?$/);
  if (match) {
    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return `${capitalize(match[1])} ${capitalize(match[2])}`;
  }
  
  // Fallback: just capitalize the part before the @
  return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
}
