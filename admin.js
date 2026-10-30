const SUPABASE_URL = 'https://dzdtwcsmznviitayttxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZHR3Y3Ntem52aWl0YXl0dHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzM4ODgsImV4cCI6MjEwODEwOTg4OH0.9J40sNaQ4iHSb0bGMSltb_V1U39upTZBbKECVRYgShY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
const TEXT_FIELDS = ['name', 'slug', 'tag', 'dates', 'image', 'music_url', 'summary'];
const SECTION_COUNT = 4;

const BUCKET = 'artist-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

let artists = [];
let suggestions = [];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nextSortOrder() {
  return artists.length
    ? Math.max(...artists.map(a => a.sort_order)) + 1
    : 1;
}

/* VIEWS */

function setActiveTab(id) {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === id);
  });
}

function showEditor(loggedIn) {
  $('auth-section').style.display = loggedIn ? 'none' : '';
  $('editor-section').style.display = loggedIn ? '' : 'none';
}

function showArtists() {
  $('suggestions-view').style.display = 'none';
  $('artists-view').style.display = '';
  setActiveTab('tab-artists');
  showList();
}

function showSuggestions() {
  $('artists-view').style.display = 'none';
  $('suggestions-view').style.display = '';
  setActiveTab('tab-suggestions');
  loadSuggestions();
}

/* Only the artist list is visible */
function showList() {
  $('artist-form').style.display = 'none';
  $('list-head').style.display = '';
  $('artist-list').style.display = '';
}

/* Only the artist form is visible */
function showForm() {
  $('artist-list').style.display = 'none';
  $('list-head').style.display = 'none';
  $('artist-form').style.display = '';
  setActiveTab('tab-artists');
}

/* ARTISTS */

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  showEditor(!!session);

  if (session) {
    showArtists();
    loadArtists();
    loadSuggestions();
  }
}

/* LOADING AND ERROR STATES */

// Placeholder cards shown while data loads
function renderSkeleton(id, count) {
  $(id).innerHTML = Array.from({ length: count }, () =>
    '<div class="skeleton" aria-hidden="true"></div>'
  ).join('');
}

// Disables the Save button and shows a spinner while the request runs
function setSaving(on) {
  const btn = document.querySelector('#artist-form button[type="submit"]');
  btn.disabled = on;
  btn.classList.toggle('is-loading', on);
}

// Removes the red border from a field once the user edits it
document.addEventListener('input', e => {
  e.target.classList.remove('is-invalid');
});

async function loadArtists() {
  renderSkeleton('artist-list', 3);

  const { data, error } = await sb
    .from('artists')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) {
    $('artist-list').innerHTML = `
      <div class="empty-state">
        <p>Could not load artists.</p>
        <span>${esc(error.message)}. Check your connection and refresh the page.</span>
      </div>
    `;
    return;
  }

  artists = data;
  renderList();
}

function renderList() {
  $('artist-list').innerHTML = artists.length
    ? artists.map(a => `
        <button class="artist-row" type="button" data-id="${a.id}">
          ${a.image
            ? `<img class="artist-thumb" src="${esc(a.image)}" alt="" />`
            : '<span class="artist-thumb placeholder" aria-hidden="true">♩</span>'}
          <span class="artist-info">
            <span class="artist-name">${esc(a.name)}</span>
            <span class="artist-meta">${[a.tag, a.dates].filter(Boolean).map(esc).join(' · ')}</span>
          </span>
          <span class="row-arrow" aria-hidden="true">→</span>
        </button>
      `).join('')
    : `
        <div class="empty-state">
          <p>No artists yet.</p>
          <span>Click "+ Add artist" to start.</span>
        </div>
      `;
}

function openForm(artist) {
  TEXT_FIELDS.forEach(f => {
    $(f).value = artist ? (artist[f] ?? '') : '';
  });

  // Show the current portrait, or hide the preview for a new artist
  showPreview(artist?.image || '');
  setUploadStatus('');

  $('sources').value = (artist?.sources || []).join('\n');

  for (let i = 0; i < SECTION_COUNT; i++) {
    const s = artist?.sections?.[i] || {};
    $(`s${i}-label`).value = s.label || '';
    $(`s${i}-heading`).value = s.heading || '';
    $(`s${i}-text`).value = s.text || '';
  }

  $('artist-id').value = artist ? artist.id : '';
  $('sort-order').value = artist ? artist.sort_order : nextSortOrder();
  $('form-title').textContent = artist ? 'Edit artist' : 'Add artist';
  $('delete-btn').style.display = artist ? '' : 'none';
  $('form-error').textContent = '';

  // Link to the public biography, only for artists already saved
  const viewLink = $('view-link');
  if (artist) {
    viewLink.href = `index.html#${artist.slug}`;
    viewLink.style.display = '';
  } else {
    viewLink.style.display = 'none';
  }

  showStep(1);
  showForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* IMAGE UPLOAD */

const dropZone = $('drop-zone');
const fileInput = $('image-file');
const previewCard = $('preview-card');
const previewImg = $('image-preview');
const progressBar = $('upload-progress');

function setUploadStatus(message, type = '') {
  const el = $('upload-status');
  el.textContent = message;
  el.className = 'upload-status' + (type ? ` is-${type}` : '');
}

// Shows the portrait card when there is an image, otherwise the drop zone
function showPreview(src) {
  if (src) {
    previewImg.src = src;
    previewCard.hidden = false;
    dropZone.hidden = true;
  } else {
    previewImg.removeAttribute('src');
    previewCard.hidden = true;
    dropZone.hidden = false;
  }
}

function setUploading(on) {
  progressBar.hidden = !on;
  dropZone.setAttribute('aria-disabled', String(on));
  dropZone.style.pointerEvents = on ? 'none' : '';
}

previewImg.addEventListener('error', () => {
  if (previewImg.getAttribute('src')) {
    setUploadStatus('This image link does not load. Check the link or upload a file.', 'error');
  }
});

// Applies a pasted link when the field loses focus or Enter is pressed
$('image').addEventListener('change', () => {
  const link = $('image').value.trim();
  setUploadStatus('');
  showPreview(link);
});

async function uploadFile(file) {
  const ext = IMAGE_EXTENSIONS[file.type];
  if (!ext) {
    setUploadStatus('Use a JPG, PNG, or WebP image.', 'error');
    return;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    setUploadStatus('This image is larger than 5 MB. Resize it and try again.', 'error');
    return;
  }

  // Timestamp keeps file names unique, so uploads never overwrite each other
  const base = $('slug').value.trim() || slugify($('name').value) || 'artist';
  const path = `${base}-${Date.now()}.${ext}`;

  setUploading(true);
  setUploadStatus('Uploading your portrait...');

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' });

  setUploading(false);

  if (error) {
    setUploadStatus('Upload failed: ' + error.message, 'error');
    return;
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);

  $('image').value = data.publicUrl;
  showPreview(data.publicUrl);
  setUploadStatus('Portrait uploaded. Click Save to keep it.', 'ok');
}

function handleFiles(files) {
  if (files && files[0]) uploadFile(files[0]);
}

// Open the file picker by click, or by Enter and Space on the keyboard
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// Drag and drop highlight
['dragenter', 'dragover'].forEach(type => {
  dropZone.addEventListener(type, e => {
    e.preventDefault();
    dropZone.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach(type => {
  dropZone.addEventListener(type, e => {
    e.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
});

dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

fileInput.addEventListener('change', e => {
  handleFiles(e.target.files);
  e.target.value = '';
});

$('replace-image').addEventListener('click', () => fileInput.click());

$('remove-image').addEventListener('click', () => {
  $('image').value = '';
  showPreview('');
  setUploadStatus('Portrait removed. Click Save to keep this change.');
});

/* FORM STEPS: one short step at a time */

const STEP_COUNT = 4;
let currentStep = 1;

function showStep(n) {
  currentStep = Math.min(Math.max(n, 1), STEP_COUNT);

  document.querySelectorAll('.form-step').forEach(step => {
    step.hidden = Number(step.dataset.step) !== currentStep;
  });

  document.querySelectorAll('.step-btn').forEach(btn => {
    const active = Number(btn.dataset.step) === currentStep;
    btn.classList.toggle('active', active);
    if (active) {
      btn.setAttribute('aria-current', 'step');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  $('step-back').hidden = currentStep === 1;
}

document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => showStep(Number(btn.dataset.step)));
});

$('step-back').addEventListener('click', () => showStep(currentStep - 1));

/* SUGGESTIONS */

async function loadSuggestions() {
  renderSkeleton('suggestion-list', 2);

  const { data, error } = await sb
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    $('suggestion-list').innerHTML = `
      <div class="empty-state">
        <p>Could not load suggestions.</p>
        <span>${esc(error.message)}. Check your connection and refresh the page.</span>
      </div>
    `;
    return;
  }

  suggestions = data;
  renderSuggestions();
  updateBadge();
}

function renderSuggestions() {
  $('suggestion-list').innerHTML = suggestions.length
    ? suggestions.map(s => `
        <div class="admin-row sugg ${s.status === 'done' ? 'is-done' : ''}">
          <div class="sugg-body">
            <p class="sugg-meta">
              ${esc(s.name || 'Anonymous')} · ${new Date(s.created_at).toLocaleDateString()}
              ${s.status === 'done' ? '· Done' : ''}
            </p>
            <p class="sugg-msg">${esc(s.message)}</p>
          </div>
          <div class="sugg-actions">
            ${s.status === 'new'
              ? `<button class="btn btn-outline" type="button" data-done="${s.id}">Mark done</button>`
              : ''}
            <button class="btn btn-danger" type="button" data-del="${s.id}">Delete</button>
          </div>
        </div>
      `).join('')
    : '<p>No suggestions yet.</p>';
}

function updateBadge() {
  const newCount = suggestions.filter(s => s.status === 'new').length;
  // The badge shows only the number, styled by admin-count.css
  $('new-count').textContent = newCount || '';
}

/* EVENTS */

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-error').textContent = '';

  const { error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  if (error) {
    $('login-error').textContent = 'Sign in failed. Check your email and password.';
    return;
  }

  $('password').value = '';
  showEditor(true);
  showArtists();
  loadArtists();
  loadSuggestions();
});

$('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  showEditor(false);
});

$('tab-artists').addEventListener('click', () => {
  showArtists();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('tab-suggestions').addEventListener('click', () => {
  showSuggestions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('new-btn').addEventListener('click', () => openForm(null));

$('artist-list').addEventListener('click', e => {
  const row = e.target.closest('[data-id]');
  if (!row) return;
  openForm(artists.find(a => a.id === row.dataset.id));
});

$('back-to-list').addEventListener('click', showList);

// Fill the slug from the name while adding a new artist
$('name').addEventListener('input', () => {
  if (!$('artist-id').value) {
    $('slug').value = slugify($('name').value);
  }
});

// Allows https links, empty values, and plain file names such as wardi.webp
function isSafeLink(value) {
  return !value || /^https:\/\//i.test(value) || /^[\w.\-\/]+$/.test(value);
}

$('artist-form').addEventListener('submit', async e => {
  e.preventDefault();

  // Hidden steps are skipped by the browser, so check every field here
  const invalidField = [...$('artist-form').querySelectorAll('input, textarea')]
    .find(field => !field.checkValidity());

  if (invalidField) {
    showStep(Number(invalidField.closest('.form-step').dataset.step));
    invalidField.classList.add('is-invalid');
    invalidField.reportValidity();
    return;
  }

  const slug = $('slug').value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    $('form-error').textContent = 'Slug can use only lowercase letters, numbers, and hyphens.';
    return;
  }

  const sections = [];
  for (let i = 0; i < SECTION_COUNT; i++) {
    const label = $(`s${i}-label`).value.trim();
    const heading = $(`s${i}-heading`).value.trim();
    const text = $(`s${i}-text`).value.trim();
    if (heading || text) {
      sections.push({ label, heading, text });
    }
  }

  const sources = $('sources').value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const row = {
    name: $('name').value.trim(),
    slug,
    tag: $('tag').value.trim(),
    dates: $('dates').value.trim(),
    image: $('image').value.trim(),
    music_url: $('music_url').value.trim(),
    summary: $('summary').value.trim(),
    sort_order: parseInt($('sort-order').value, 10) || 0,
    sources,
    sections
  };

  $('music_url').classList.toggle('is-invalid', !isSafeLink(row.music_url));
  $('image').classList.toggle('is-invalid', !isSafeLink(row.image));

  if (!isSafeLink(row.music_url) || !isSafeLink(row.image)) {
    $('form-error').textContent = 'Links must start with https://, or be a plain file name such as wardi.webp.';
    return;
  }

  const id = $('artist-id').value;

  setSaving(true);
  const result = id
    ? await sb.from('artists').update(row).eq('id', id)
    : await sb.from('artists').insert(row);
  setSaving(false);

  if (result.error) {
    $('form-error').textContent = result.error.message.includes('duplicate')
      ? 'This slug is already used by another artist. Change the slug.'
      : result.error.message;
    return;
  }

  $('form-error').textContent = '';
  showList();
  loadArtists();
});

$('delete-btn').addEventListener('click', async () => {
  const id = $('artist-id').value;
  if (!id || !confirm('Delete this artist? This cannot be undone.')) return;

  const { error } = await sb.from('artists').delete().eq('id', id);
  if (error) {
    alert(error.message);
    return;
  }

  showList();
  loadArtists();
});

$('suggestion-list').addEventListener('click', async e => {
  const doneId = e.target.dataset.done;
  const delId = e.target.dataset.del;

  if (doneId) {
    const { error } = await sb
      .from('suggestions')
      .update({ status: 'done' })
      .eq('id', doneId);

    if (error) {
      alert(error.message);
      return;
    }
    loadSuggestions();
    return;
  }

  if (delId) {
    if (!confirm('Delete this suggestion? This cannot be undone.')) return;

    const { error } = await sb
      .from('suggestions')
      .delete()
      .eq('id', delId);

    if (error) {
      alert(error.message);
      return;
    }
    loadSuggestions();
  }
});

init();
