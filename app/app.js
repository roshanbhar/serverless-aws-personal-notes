const config = window.APP_CONFIG;
const $ = (selector) => document.querySelector(selector);
const els = { signIn: $('#signin'), signOut: $('#signout'), signedOut: $('#signedout'), notebook: $('#notebook'), form: $('#noteform'), note: $('#note'), message: $('#message'), notes: $('#notes'), count: $('#count') };
let accessToken = sessionStorage.getItem('notes_access_token');

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}
async function sha256(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function authorizeUrl(path) { return `${config.cognitoDomain}${path}`; }

async function startSignIn() {
  const verifier = randomString();
  const state = randomString(32);
  sessionStorage.setItem('notes_pkce_verifier', verifier);
  sessionStorage.setItem('notes_oauth_state', state);
  const challenge = base64url(await sha256(verifier));
  const params = new URLSearchParams({ client_id: config.clientId, response_type: 'code', scope: 'openid email', redirect_uri: config.redirectUri, state, code_challenge_method: 'S256', code_challenge: challenge });
  window.location.assign(authorizeUrl(`/oauth2/authorize?${params}`));
}

async function handleCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return;
  const state = url.searchParams.get('state');
  const expectedState = sessionStorage.getItem('notes_oauth_state');
  const verifier = sessionStorage.getItem('notes_pkce_verifier');
  sessionStorage.removeItem('notes_oauth_state');
  sessionStorage.removeItem('notes_pkce_verifier');
  if (!state || state !== expectedState || !verifier) throw new Error('Sign-in could not be verified. Please try again.');
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, code, redirect_uri: config.redirectUri, code_verifier: verifier });
  const response = await fetch(authorizeUrl('/oauth2/token'), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Sign-in did not complete.');
  accessToken = data.access_token;
  sessionStorage.setItem('notes_access_token', accessToken);
  window.history.replaceState({}, '', config.redirectUri);
}

function signOut() {
  sessionStorage.clear();
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: config.logoutUri });
  window.location.assign(authorizeUrl(`/logout?${params}`));
}

async function api(path, options = {}) {
  const response = await fetch(`${config.apiUrl}${path}`, { ...options, headers: { authorization: `Bearer ${accessToken}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) { signOut(); throw new Error('Please sign in again.'); }
  if (!response.ok) throw new Error(payload.message || 'The request could not be completed.');
  return payload;
}

function displayNotes(notes) {
  els.count.textContent = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;
  if (!notes.length) { els.notes.innerHTML = '<p class="empty-state">Your notebook is ready when you are.</p>'; return; }
  els.notes.replaceChildren(...notes.map((note) => {
    const card = document.createElement('article'); card.className = 'note-card';
    const content = document.createElement('div');
    const text = document.createElement('p'); text.className = 'note-text'; text.textContent = note.text;
    const date = document.createElement('p'); date.className = 'note-date'; date.textContent = new Date(note.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    content.append(text, date);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Delete note');
    remove.addEventListener('click', async () => { remove.disabled = true; try { await api(`/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' }); await loadNotes(); } catch (error) { showMessage(error.message); remove.disabled = false; } });
    card.append(content, remove); return card;
  }));
}
async function loadNotes() { const data = await api('/notes'); displayNotes(data.notes); }
function showMessage(message) { els.message.textContent = message; }

els.signIn.addEventListener('click', () => startSignIn().catch((error) => showMessage(error.message)));
els.signOut.addEventListener('click', signOut);
els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = els.note.value.trim();
  if (!text) return;
  const button = els.form.querySelector('button'); button.disabled = true; showMessage('Saving your note...');
  try { await api('/notes', { method: 'POST', body: JSON.stringify({ text }) }); els.note.value = ''; showMessage('Saved to your notebook.'); await loadNotes(); }
  catch (error) { showMessage(error.message); }
  finally { button.disabled = false; }
});

try {
  await handleCallback();
  if (accessToken) { els.signedOut.classList.add('hidden'); els.notebook.classList.remove('hidden'); els.signOut.classList.remove('hidden'); await loadNotes(); }
} catch (error) { accessToken = null; sessionStorage.removeItem('notes_access_token'); showMessage(error.message); }
