const SUPABASE_URL = 'https://dzdtwcsmznviitayttxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZHR3Y3Ntem52aWl0YXl0dHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzM4ODgsImV4cCI6MjEwODEwOTg4OH0.9J40sNaQ4iHSb0bGMSltb_V1U39upTZBbKECVRYgShY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 8;
const SITE_TITLE = 'Sudan Music Archive';

let ARTISTS = {};
let ORDER = [];
let LIST = [];
let currentPage = 1;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/* LOAD DATA */

async function loadArtists() {

  const { data, error } = await sb
    .from('artists')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) {
    document.getElementById('artist-cards').innerHTML =
      '<p class="loading-note">Could not load the archive. Please refresh the page.</p>';
    console.error('Could not load artists:', error.message);
    return;
  }

  ARTISTS = Object.fromEntries(
    data.map(a => [a.slug, a])
  );

  ORDER = data.map(a => a.slug);

  currentPage = getPageFromUrl();

  renderNav();
  renderCards(data);

  // Open the artist named in the link, such as site.html#kabli
  openFromHash();
}

/* NAVBAR: Suggest, then About. Artists are reached from the grid and Previous/Next */

function renderNav() {

  document.getElementById('nav-links').innerHTML = `
    <li>
      <button class="nav-cta" type="button" onclick="openSuggestions(event)">
        Suggest an artist
      </button>
    </li>

    <li>
      <a href="about.html" class="nav-button">About</a>
    </li>
  `;
}

function openSuggestions(e) {

  e.preventDefault();

  closeAllNav();

  // Leave a biography first, so the suggestion box is on screen
  if (document.getElementById('bio-view').style.display === 'flex') {
    showHome();
  }

  const box = document.getElementById('suggest-form');

  box.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Focus the message field so the visitor can type straight away
  document.getElementById('suggest-message').focus({ preventScroll: true });
}

/* ARTIST GRID, 8 per page */

function totalPages() {
  return Math.max(1, Math.ceil(LIST.length / PAGE_SIZE));
}

function renderCards(list) {

  LIST = list;

  if (currentPage > totalPages()) {
    currentPage = totalPages();
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = LIST.slice(start, start + PAGE_SIZE);

  document.getElementById('artist-cards').innerHTML = visible
    .map(a => `
      <div class="artist-card" onclick="showBio(null, '${escapeHtml(a.slug)}')">
        <img src="${escapeHtml(a.image)}" alt="Portrait of ${escapeHtml(a.name)}" class="artist-img" />
        <span class="ac-name">${escapeHtml(a.name)}</span>
      </div>
    `)
    .join('');

  renderArtistPager();
}

function getPageFromUrl() {
  const page = parseInt(new URLSearchParams(location.search).get('page'), 10);
  return page > 0 ? page : 1;
}

function getArtistPager() {

  let pager = document.getElementById('artist-pager');

  if (!pager) {
    pager = document.createElement('nav');
    pager.id = 'artist-pager';
    pager.className = 'artist-pager';
    document.getElementById('artist-cards').after(pager);
  }

  return pager;
}

function renderArtistPager() {

  const pager = getArtistPager();
  const total = totalPages();

  // With one page, no numbers appear at all
  if (total <= 1) {
    pager.innerHTML = '';
    return;
  }

  const pageButtons = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const active = n === currentPage;

    return `
      <button class="page-btn ${active ? 'active' : ''}" type="button"
        ${active ? 'aria-current="page"' : ''}
        onclick="goToPage(${n})">${n}</button>
    `;
  }).join('');

  pager.innerHTML = `
    <button class="page-btn" type="button"
      ${currentPage === 1 ? 'disabled' : ''}
      onclick="goToPage(${currentPage - 1})">← Prev</button>

    ${pageButtons}

    <button class="page-btn" type="button"
      ${currentPage === total ? 'disabled' : ''}
      onclick="goToPage(${currentPage + 1})">Next →</button>
  `;
}

function goToPage(n) {

  if (n < 1 || n > totalPages()) return;

  currentPage = n;

  // Page 1 has a clean address, other pages show ?page=n
  const url = n === 1
    ? location.pathname
    : `${location.pathname}?page=${n}`;

  history.pushState(null, '', url);

  renderCards(LIST);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* HOME */

function showHome(fromHistory = false) {

  document.getElementById('home-view').style.display = '';
  document.getElementById('bio-view').style.display = 'none';

  // Browser tab shows the site name on the home page
  document.title = SITE_TITLE;

  // Remove the artist from the address bar, keep the page number
  if (!fromHistory && location.hash) {
    history.pushState(null, '', location.pathname + location.search);
  }

  closeAllNav();
  window.scrollTo(0, 0);
}

/* NAVIGATION */

function closeAllNav() {

  document
    .querySelectorAll('#nav-links > li')
    .forEach(li => li.classList.remove('open'));
}

/* SHAREABLE LINKS */

function openFromHash() {

  const key = location.hash.slice(1);
  if (key && ARTISTS[key]) {
    showBio(null, key, true);
  }
}

// Browser back and forward buttons
window.addEventListener('popstate', () => {

  const key = location.hash.slice(1);

  if (key && ARTISTS[key]) {
    showBio(null, key, true);
  } else {
    currentPage = getPageFromUrl();
    showHome(true);
    renderCards(LIST);
  }
});

/* SOURCES: links open in a new tab, plain text stays as text */

function renderSources(sources) {

  if (!sources || !sources.length) return '';

  const items = sources
    .map(src => /^https?:\/\//i.test(src)
      ? `<li><a href="${escapeHtml(src)}" target="_blank" rel="noopener">${escapeHtml(src)}</a></li>`
      : `<li>${escapeHtml(src)}</li>`)
    .join('');

  return `
    <div class="bio-section bio-sources">
      <p class="bio-section-label">Sources</p>
      <ul>${items}</ul>
    </div>
  `;
}

/* PREVIOUS AND NEXT ARTIST */

function renderPager(key) {

  const index = ORDER.indexOf(key);
  const prev = index > 0 ? ORDER[index - 1] : null;
  const next = index < ORDER.length - 1 ? ORDER[index + 1] : null;

  return `
    <nav class="bio-pager">
      ${prev
        ? `<a href="#${escapeHtml(prev)}" onclick="showBio(event, '${escapeHtml(prev)}')">← ${escapeHtml(ARTISTS[prev].name)}</a>`
        : '<span></span>'}
      ${next
        ? `<a href="#${escapeHtml(next)}" onclick="showBio(event, '${escapeHtml(next)}')">${escapeHtml(ARTISTS[next].name)} →</a>`
        : '<span></span>'}
    </nav>
  `;
}

/* BIOGRAPHY PAGE */

function showBio(e, key, fromHistory = false) {

  if (e) e.preventDefault();

  closeAllNav();

  const artist = ARTISTS[key];
  if (!artist) return;

  const sectionsHTML = (artist.sections || [])
    .map(section => `
      <div class="bio-section">
        <p class="bio-section-label">${escapeHtml(section.label)}</p>
        <h2>${escapeHtml(section.heading)}</h2>
        <p>${escapeHtml(section.text)}</p>
      </div>
    `)
    .join('');

  document.getElementById('bio-content').innerHTML = `
    <button class="bio-back" onclick="showHome()">
      ← Back to Archive
    </button>

    <div class="bio-header">
      <div class="bio-img-wrap">
        <img src="${escapeHtml(artist.image)}" alt="Portrait of ${escapeHtml(artist.name)}" />
      </div>

      <div class="bio-intro">
        <span class="bio-tag">${escapeHtml(artist.tag)}</span>
        <h1 class="bio-name">${escapeHtml(artist.name)}</h1>
        <p class="bio-dates">${escapeHtml(artist.dates)}</p>
        <p class="bio-summary">${escapeHtml(artist.summary)}</p>

        ${artist.updated_at
          ? `<p class="bio-updated">Last updated ${escapeHtml(formatDate(artist.updated_at))}</p>`
          : ''}

        ${artist.music_url
          ? `<a href="${escapeHtml(artist.music_url)}" target="_blank" class="bio-music-btn">▶ Listen on YouTube</a>`
          : ''}
      </div>
    </div>

    ${sectionsHTML}

    ${renderSources(artist.sources)}

    ${renderPager(key)}
  `;

  document.getElementById('home-view').style.display = 'none';
  document.getElementById('bio-view').style.display = 'flex';

  // Each biography gets its own browser tab title
  document.title = `${artist.name} | ${SITE_TITLE}`;

  // Put the artist in the address bar so the link can be shared
  if (!fromHistory && location.hash !== '#' + key) {
    history.pushState(null, '', '#' + key);
  }

  window.scrollTo(0, 0);
}

/* START */

loadArtists();

document.addEventListener('click', e => {
  if (!e.target.closest('#nav-links')) {
    closeAllNav();
  }
});
