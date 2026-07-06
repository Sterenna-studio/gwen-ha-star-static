/**
 * cig.js — Carte d'Identification Galactique · Gwen Ha Star
 * Extrait de cig.html + fillGIGCard()
 */
import { supabase, getSession, signOut } from './supabase.js';

// ── RARITY CONFIG ──────────────────────────────────────────────────────────────
const RARITY_COLORS = {
  common:    '#8a9ab5',
  uncommon:  '#3ecfcf',
  rare:      '#3ecfcf',
  epic:      '#7b5cf0',
  legendary: '#f9ca24',
};
const RARITY_LABEL = {
  common:    'COMMUN',
  uncommon:  'COMMUN',
  rare:      'RARE',
  epic:      'ÉPIQUE',
  legendary: 'LÉGENDAIRE',
};
const RARITY_ORDER = ['legendary','epic','rare','uncommon','common'];

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,24}$/;
const BIO_WARN = 180;
const BIO_MAX  = 200;

const $    = id => document.getElementById(id);
const show = id => { const e=$(id); if(e) e.style.display=''; };
const hide = id => { const e=$(id); if(e) e.style.display='none'; };

function setStatus(elId, msg, type) {
  const el = $(elId);
  if (!el) return;
  el.textContent = msg;
  el.className = 'save-status ' + type;
  setTimeout(() => { el.className = 'save-status'; }, 3000);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' });
}

function rarityColor(rarity) {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
}

// ── FILL GIG ID CARD ───────────────────────────────────────────────────────────
function fillGIGCard(profile, username, activeTitleDisplay, activeTitleRarity) {
  const avatarEl = $('gig-card-avatar');
  if (!avatarEl) return;
  if (profile.avatar_url) {
    avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="${username}" loading="lazy"/>`;
  } else {
    avatarEl.textContent = username.charAt(0).toUpperCase();
  }
  const titleEl = $('gig-card-title');
  if (titleEl) {
    titleEl.textContent = '◆ ' + activeTitleDisplay.toUpperCase();
    titleEl.style.color = rarityColor(activeTitleRarity);
  }
  const pseudoEl = $('gig-card-pseudo');
  if (pseudoEl) pseudoEl.textContent = username.toUpperCase();

  const chrEl = $('gig-card-chr');
  if (chrEl) chrEl.textContent = (profile.chronicles ?? 0).toLocaleString('fr-FR') + ' C';

  const dateEl = $('gig-card-date');
  if (dateEl) dateEl.textContent = formatDate(profile.joined_at ?? profile.created_at);

  const uidEl = $('gig-card-uid');
  if (uidEl) uidEl.textContent = 'UID ' + (profile.id ?? '—').substring(0, 8).toUpperCase() + ' ···';
}

// ── LEADERBOARD ────────────────────────────────────────────────────────────────
async function loadLeaderboard(myId) {
  const listEl = $('lb-list');
  if (!listEl) return;
  listEl.innerHTML = Array.from({length:5}, () => '<div class="skel lb-skel-row"></div>').join('');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, active_title, chronicles')
      .not('chronicles', 'is', null)
      .order('chronicles', { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!data?.length) { listEl.innerHTML = '<p class="lb-empty">AUCUN JOUEUR CLASSÉ</p>'; return; }
    const maxCredits = data[0].chronicles ?? 1;
    listEl.innerHTML = data.map((p, i) => {
      const rank     = i + 1;
      const isMe     = p.id === myId;
      const username = (p.username ?? 'AGENT').toUpperCase();
      const credits  = (p.chronicles ?? 0).toLocaleString('fr-FR');
      const barPct   = Math.round(((p.chronicles ?? 0) / maxCredits) * 100);
      const posClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const medal    = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const rowClass = `lb-row${isMe ? ' lb-me' : ''}${rank <= 3 ? ` lb-top${rank}` : ''}`;
      const avatarHTML = p.avatar_url
        ? `<div class="lb-avatar"><img src="${p.avatar_url}" alt="${username}" loading="lazy"/></div>`
        : `<div class="lb-avatar">${username.charAt(0)}</div>`;
      return `
      <div class="${rowClass}" title="${username}">
        <span class="lb-pos ${posClass}">${medal}</span>
        ${avatarHTML}
        <div style="min-width:0">
          <div class="lb-name">${username}${isMe ? '<span class="lb-me-tag">▶ MOI</span>' : ''}</div>
          <div class="lb-title">${(p.active_title ?? 'RECRUE').toUpperCase()}</div>
        </div>
        <div class="lb-bar-wrap"><div class="lb-bar" style="width:${barPct}%"></div></div>
        <span class="lb-credits">${credits} C</span>
      </div>`;
    }).join('');
    if (myId) {
      const myIdx = data.findIndex(p => p.id === myId);
      if (myIdx !== -1) {
        const rank = myIdx + 1;
        const rankEl = $('chr-rank-val'), nameEl = $('chr-rank-name'), blockEl = $('chr-rank-block');
        if (rankEl)  { rankEl.textContent = `#${rank}`; rankEl.className = 'chr-rank-val ' + (rank===1?'gold':rank===2?'silver':rank===3?'bronze':''); }
        if (nameEl)  nameEl.textContent = rank <= 3 ? ['🥇 1ER','🥈 2ÈME','🥉 3ÈME'][rank-1] : `TOP ${rank}`;
        if (blockEl) blockEl.style.display = '';
      }
    }
  } catch(e) {
    console.error(e);
    listEl.innerHTML = '<p class="lb-empty">ERREUR CHARGEMENT LEADERBOARD</p>';
  }
}

// ── FILL CIG ───────────────────────────────────────────────────────────────────
function fillCIG(profile, joinedTitles, user, readOnly) {
  const username    = profile.username    ?? user.email?.split('@')[0] ?? 'AGENT';
  const role        = profile.role        ?? 'guest';
  const activeTitle = profile.active_title ?? 'Recrue';
  const specialty   = profile.specialty   ?? '';

  const ownedMap = new Map();
  joinedTitles.forEach(pt => { if (pt.titles) ownedMap.set(pt.titles.slug ?? pt.title_slug, pt.titles); });

  $('bc-name').textContent      = username.toUpperCase();
  $('cig-username').textContent = username.toUpperCase();
  $('cig-bio').textContent      = profile.bio ?? '';
  $('cig-email').textContent    = readOnly ? '—' : (user.email ?? '—');
  $('cig-joined').textContent   = formatDate(profile.joined_at ?? profile.created_at);
  $('cig-lang').textContent     = (profile.lang ?? 'fr').toUpperCase();

  const activeTitleObj = [...ownedMap.values()].find(t =>
    (t.label_fr ?? t.label ?? t.slug ?? '').toLowerCase() === activeTitle.toLowerCase()
  );
  const activeTitleRarity  = activeTitleObj?.rarity ?? 'common';
  const activeTitleDisplay = activeTitleObj?.label_fr ?? activeTitleObj?.label ?? activeTitle;
  const titleEl = $('cig-active-title');
  titleEl.textContent  = '◆ ' + activeTitleDisplay.toUpperCase();
  titleEl.style.color  = rarityColor(activeTitleRarity);

  const badgesEl = $('cig-hero-badges');
  badgesEl.innerHTML = '';
  const roleBadge = document.createElement('span');
  roleBadge.className = `cig-badge role-${role}`;
  roleBadge.textContent = role.toUpperCase();
  badgesEl.appendChild(roleBadge);
  if (specialty) {
    const specBadge = document.createElement('span');
    specBadge.className = 'cig-badge specialty';
    specBadge.textContent = specialty.toUpperCase();
    badgesEl.appendChild(specBadge);
  }

  $('cig-tag').textContent         = `// AGENT · ${role.toUpperCase()}`;
  $('cig-role-dot').className      = 'cig-role-dot ' + role;
  $('cig-role-badge').className    = 'cig-role-badge ' + role;
  $('cig-role-badge').textContent  = role.toUpperCase();

  const chrVal = $('chr-val');
  if (chrVal) chrVal.textContent = (profile.chronicles ?? 0).toLocaleString('fr-FR') + ' C';

  if (profile.avatar_url) {
    const img = $('cig-avatar-img');
    img.src = profile.avatar_url;
    img.style.display = 'block';
    $('cig-avatar-fallback').style.display = 'none';
  } else {
    $('cig-avatar-fallback').textContent = username.charAt(0).toUpperCase();
  }

  $('f-username').value   = profile.username   ?? '';
  $('f-specialty').value  = profile.specialty  ?? '';
  $('f-bio').value        = profile.bio        ?? '';
  $('f-avatar-url').value = profile.avatar_url ?? '';
  if (!readOnly) {
    $('f-uuid').value   = profile.id ?? user.id;
    $('f-email').value  = user.email ?? '';
    $('f-role').value   = role.toUpperCase();
    $('f-joined').value = formatDate(profile.joined_at ?? profile.created_at);
  }

  updateBioCounter($('f-bio').value.length);

  // ── GIG ID CARD ──────────────────────────────────────────────────────────────
  fillGIGCard(profile, username, activeTitleDisplay, activeTitleRarity);

  // ── Titres ───────────────────────────────────────────────────────────────────
  const FALLBACK_CATALOG = [
    { slug:'recrue',       label_fr:'Recrue',       rarity:'common'    },
    { slug:'agent',        label_fr:'Agent',        rarity:'common'    },
    { slug:'veteran',      label_fr:'Vétéran',      rarity:'common'    },
    { slug:'speculateur',  label_fr:'Spéculateur',  rarity:'common'    },
    { slug:'grand-joueur', label_fr:'Grand Joueur', rarity:'rare'      },
    { slug:'lore-master',  label_fr:'Lore Master',  rarity:'rare'      },
    { slug:'explorateur',  label_fr:'Explorateur',  rarity:'rare'      },
    { slug:'bankroll',     label_fr:'Bankroll',     rarity:'epic'      },
    { slug:'champion',     label_fr:'Champion',     rarity:'epic'      },
    { slug:'legende',      label_fr:'Légende',      rarity:'legendary' },
    { slug:'fondateur',    label_fr:'Fondateur',    rarity:'legendary' },
    { slug:'protocole',    label_fr:'Protocole',    rarity:'legendary' },
  ];
  const ownedArr = ownedMap.size > 0
    ? Array.from(ownedMap.values())
    : joinedTitles.map(pt => FALLBACK_CATALOG.find(t => t.slug === pt.title_slug) ?? { slug: pt.title_slug, label_fr: pt.title_slug, rarity: 'common' });

  const list = $('titles-list');
  list.innerHTML = '';
  const groups = {};
  RARITY_ORDER.forEach(r => { groups[r] = []; });
  ownedArr.forEach(t => {
    const r = t.rarity ?? 'common';
    if (!groups[r]) groups[r] = [];
    groups[r].push(t);
  });

  let totalOwned = 0;
  RARITY_ORDER.forEach(rarity => {
    const titles = groups[rarity];
    if (!titles.length) return;
    totalOwned += titles.length;
    const sectionLabel = document.createElement('p');
    sectionLabel.className = 'titles-section-label';
    const col = rarityColor(rarity);
    sectionLabel.innerHTML = `<span style="color:${col}">${RARITY_LABEL[rarity] ?? rarity.toUpperCase()}</span> <span class="titles-count">(${titles.length})</span>`;
    list.appendChild(sectionLabel);
    const row = document.createElement('div');
    row.className = 'titles-chips';
    titles.forEach(t => {
      const label    = t.label_fr ?? t.label ?? t.slug ?? '?';
      const isActive = label.toLowerCase() === activeTitle.toLowerCase() ||
                       (t.slug ?? '').toLowerCase() === activeTitle.toLowerCase();
      const chip = document.createElement('span');
      chip.className = 'title-chip' + (isActive ? ' active' : '');
      if (rarity !== 'common' && rarity !== 'uncommon') chip.dataset.rarity = rarity;
      chip.textContent = label.toUpperCase();
      chip.style.setProperty('--chip-color', col);
      if (!readOnly) {
        chip.addEventListener('click', () => {
          list.querySelectorAll('.title-chip:not(.locked)').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          updateTitlePreview(label, rarity);
        });
      }
      row.appendChild(chip);
    });
    list.appendChild(row);
  });

  if (totalOwned === 0) {
    const none = document.createElement('span');
    none.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--c-text-faint);opacity:.5';
    none.textContent = 'aucun titre débloqué';
    list.appendChild(none);
  }

  updateTitlePreview(activeTitleDisplay, activeTitleRarity);

  if (readOnly) {
    $('cig-grid').classList.add('readonly-mode');
    show('view-banner');
    hide('card-danger');
  }
}

function updateTitlePreview(label, rarity) {
  const el = $('title-preview');
  if (!el) return;
  const col = rarityColor(rarity);
  const rl  = RARITY_LABEL[rarity] ?? '';
  el.innerHTML = `<span style="color:${col}">◆ ${label.toUpperCase()}</span> <span style="font-size:8px;opacity:.6;color:${col}">${rl}</span>`;
}

function updateBioCounter(len) {
  const el = $('bio-counter');
  if (!el) return;
  el.textContent = `${len} / ${BIO_MAX}`;
  el.className   = 'bio-counter' + (len >= BIO_MAX ? ' max' : len >= BIO_WARN ? ' warn' : '');
}

function setSyncState(modified) {
  const ind   = $('sync-indicator');
  const label = $('sync-label');
  if (!ind || !label) return;
  if (modified) {
    ind.className   = 'sync-indicator modified';
    label.textContent = 'MODIFIED';
  } else {
    ind.className   = 'sync-indicator synced';
    label.textContent = 'SYNCED';
  }
}

function injectHeaderAuth(user, profile) {
  const authZone = $('header-auth');
  if (!authZone) return;
  const username = profile?.username ?? user.email?.split('@')[0] ?? 'AGENT';
  authZone.innerHTML = `
    <div class="auth-connected">
      <span class="auth-badge" title="${user.email}">
        <span class="auth-dot"></span>
        <span class="auth-label">${username.toUpperCase()}</span>
      </span>
      <a href="/cig.html" class="btn-auth btn-auth-cig">⬡ MON ESPACE</a>
      <button class="btn-auth btn-auth-signout" id="hdr-logout" aria-label="Déconnexion">✕</button>
    </div>`;
  $('hdr-logout')?.addEventListener('click', () => signOut());
}

// ── INIT ───────────────────────────────────────────────────────────────────────
async function init() {
  const params   = new URLSearchParams(window.location.search);
  const targetId = params.get('id');
  const session  = await getSession();

  if (!session && !targetId) {
    hide('cig-skeleton');
    show('cig-unauth');
    return;
  }

  const myId      = session?.user?.id ?? null;
  const readOnly  = !!(targetId && targetId !== myId);
  const profileId = targetId ?? myId;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_titles (
        title_slug,
        titles (*)
      )
    `)
    .eq('id', profileId)
    .single();

  if (error && error.code !== 'PGRST116') console.error(error);

  const joinedTitles = profile?.profile_titles ?? [];
  const user = readOnly ? { id: profileId, email: null } : session.user;

  hide('cig-skeleton');
  fillCIG(profile ?? {}, joinedTitles, user, readOnly);
  if (session) injectHeaderAuth(session.user, session.user.id === profileId ? profile : null);
  show('cig-content');
  await loadLeaderboard(myId);
  $('lb-refresh')?.addEventListener('click', () => loadLeaderboard(myId));

  if (readOnly) return;

  const snapshot = {
    username:   profile?.username   ?? '',
    specialty:  profile?.specialty  ?? '',
    bio:        profile?.bio        ?? '',
    avatar_url: profile?.avatar_url ?? '',
  };

  function validateUsername(val) {
    const hint  = $('username-hint');
    const input = $('f-username');
    if (!USERNAME_REGEX.test(val)) {
      input.classList.add('invalid');
      if (hint) { hint.textContent = '⚠ 3–24 car. · lettres, chiffres, _ et - uniquement'; hint.className = 'field-hint err'; }
      return false;
    }
    input.classList.remove('invalid');
    if (hint) { hint.textContent = '3–24 car. · lettres, chiffres, _ et -'; hint.className = 'field-hint'; }
    return true;
  }

  $('f-username').addEventListener('input', () => { validateUsername($('f-username').value); setSyncState(true); });
  $('f-specialty').addEventListener('input', () => setSyncState(true));
  $('f-bio').addEventListener('input', () => { updateBioCounter($('f-bio').value.length); setSyncState(true); });
  $('f-avatar-url').addEventListener('input', () => setSyncState(true));

  $('btn-reset-profile').addEventListener('click', () => {
    $('f-username').value   = snapshot.username;
    $('f-specialty').value  = snapshot.specialty;
    $('f-bio').value        = snapshot.bio;
    $('f-avatar-url').value = snapshot.avatar_url;
    validateUsername(snapshot.username);
    updateBioCounter(snapshot.bio.length);
    setSyncState(false);
  });

  const dangerToggle = $('danger-toggle');
  const dangerBody   = $('danger-body');
  const dangerArrow  = $('danger-arrow');
  function toggleDanger() {
    const open = dangerBody.classList.toggle('open');
    dangerArrow.classList.toggle('open', open);
    dangerToggle.setAttribute('aria-expanded', String(open));
  }
  dangerToggle?.addEventListener('click', toggleDanger);
  dangerToggle?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDanger(); } });

  let isDirty = false;
  const markDirty = () => { isDirty = true; setSyncState(true); };
  $('f-username').addEventListener('input', markDirty);
  $('f-specialty').addEventListener('input', markDirty);
  $('f-bio').addEventListener('input', markDirty);
  $('f-avatar-url').addEventListener('input', markDirty);
  window.addEventListener('beforeunload', e => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } });

  const uploadBtn   = $('cig-avatar-upload-btn');
  const fileInput   = $('cig-avatar-file');
  const uploadLabel = $('cig-upload-label');
  uploadBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setStatus('status-profile', '⚠ IMAGE TROP LOURDE (max 3 Mo)', 'err');
      fileInput.value = ''; return;
    }
    uploadBtn.classList.add('uploading');
    uploadBtn.disabled = true;
    uploadLabel.textContent = '⏳';
    try {
      const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
      const path = `${myId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: saveErr } = await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', myId);
      if (saveErr) throw saveErr;
      $('f-avatar-url').value = finalUrl;
      $('cig-avatar-img').src = finalUrl;
      $('cig-avatar-img').style.display = 'block';
      $('cig-avatar-fallback').style.display = 'none';
      snapshot.avatar_url = finalUrl;
      setStatus('status-profile', '✓ PHOTO MISE À JOUR', 'ok');
    } catch (err) {
      console.error('Upload avatar:', err);
      setStatus('status-profile', '⚠ ERREUR : ' + (err.message ?? 'upload échoué'), 'err');
    } finally {
      uploadBtn.classList.remove('uploading');
      uploadBtn.disabled = false;
      uploadLabel.textContent = '📷 UPLOAD';
      fileInput.value = '';
    }
  });

  $('btn-save-profile').addEventListener('click', async () => {
    const usernameVal = $('f-username').value.trim();
    if (!validateUsername(usernameVal)) return;
    $('btn-save-profile').disabled = true;
    const updates = {
      username:   usernameVal || null,
      specialty:  $('f-specialty').value.trim()  || null,
      bio:        $('f-bio').value.trim()         || null,
      avatar_url: $('f-avatar-url').value.trim() || null,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', myId);
    $('btn-save-profile').disabled = false;
    if (error) {
      setStatus('status-profile', '⚠ ' + error.message, 'err');
    } else {
      setStatus('status-profile', '✓ SAUVEGARDÉ', 'ok');
      Object.assign(snapshot, updates);
      isDirty = false;
      setSyncState(false);
      const newUsername = updates.username ?? session.user.email?.split('@')[0] ?? 'AGENT';
      $('cig-username').textContent = newUsername.toUpperCase();
      $('cig-bio').textContent      = updates.bio ?? '';
      if (updates.avatar_url) {
        $('cig-avatar-img').src = updates.avatar_url;
        $('cig-avatar-img').style.display = 'block';
        $('cig-avatar-fallback').style.display = 'none';
      }
    }
  });

  $('btn-save-title').addEventListener('click', async () => {
    const activeChip = $('titles-list').querySelector('.title-chip.active');
    if (!activeChip) return;
    const newTitle = activeChip.textContent;
    const rarity   = activeChip.dataset.rarity ?? 'common';
    $('btn-save-title').disabled = true;
    const { error } = await supabase.from('profiles').update({ active_title: newTitle }).eq('id', myId);
    $('btn-save-title').disabled = false;
    if (error) {
      setStatus('status-title', '⚠ ' + error.message, 'err');
    } else {
      setStatus('status-title', '✓ APPLIQUÉ', 'ok');
      const titleEl = $('cig-active-title');
      titleEl.textContent = '◆ ' + newTitle;
      titleEl.style.color = rarityColor(rarity);
    }
  });

  $('btn-logout').addEventListener('click', () => signOut());
}

init();
