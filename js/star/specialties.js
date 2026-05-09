/**
 * specialties.js — Gestion des spécialités et titres agents
 * Requêtes Supabase + helpers de rendu pour CIG, crew, admin
 */
import { supabase } from '../supabase.js';

// ─── SPÉCIALITÉS ─────────────────────────────────────────────────────────────

/** Retourne toutes les spécialités disponibles */
export async function getSpecialties() {
  const { data, error } = await supabase
    .from('specialties')
    .select('id, slug, label_fr, label_en, description_fr, icon, color, is_selectable')
    .order('label_fr');
  if (error) { console.error('[specialties] getSpecialties:', error.message); return []; }
  return data ?? [];
}

/** Retourne la spécialité d'un agent via son specialty_id */
export async function getAgentSpecialty(specialtyId) {
  if (!specialtyId) return null;
  const { data, error } = await supabase
    .from('specialties')
    .select('id, slug, label_fr, icon, color')
    .eq('id', specialtyId)
    .single();
  if (error) { console.error('[specialties] getAgentSpecialty:', error.message); return null; }
  return data;
}

/**
 * Met à jour la spécialité d'un agent (self uniquement — RLS enforce)
 * @param {string} agentId  uuid du profil
 * @param {string} specialtyId  uuid de la spécialité choisie
 */
export async function updateAgentSpecialty(agentId, specialtyId) {
  const { error } = await supabase
    .from('profiles')
    .update({ specialty_id: specialtyId })
    .eq('id', agentId);
  if (error) { console.error('[specialties] updateAgentSpecialty:', error.message); return false; }
  return true;
}

// ─── TITRES ───────────────────────────────────────────────────────────────────

/** Retourne tous les titres disponibles */
export async function getTitles() {
  const { data, error } = await supabase
    .from('titles')
    .select('id, slug, label_fr, label_en, description_fr, category, rarity, unlock_type, price_coins, is_active')
    .eq('is_active', true)
    .order('rarity');
  if (error) { console.error('[specialties] getTitles:', error.message); return []; }
  return data ?? [];
}

/** Retourne les titres débloqués par un agent */
export async function getAgentTitles(agentId) {
  if (!agentId) return [];
  const { data, error } = await supabase
    .from('agent_titles')
    .select('unlocked_at, source, title:title_id(id, slug, label_fr, label_en, rarity, category)')
    .eq('agent_id', agentId)
    .order('unlocked_at', { ascending: false });
  if (error) { console.error('[specialties] getAgentTitles:', error.message); return []; }
  return data ?? [];
}

/**
 * Débloque un titre pour un agent (admin/achievement — RLS enforce)
 * @param {string} agentId
 * @param {string} titleId
 * @param {'achievement'|'purchase'|'admin'} source
 */
export async function unlockTitle(agentId, titleId, source = 'achievement') {
  const { error } = await supabase
    .from('agent_titles')
    .insert({ agent_id: agentId, title_id: titleId, source });
  if (error) { console.error('[specialties] unlockTitle:', error.message); return false; }
  return true;
}

/**
 * Définit le titre actif d'un agent (self uniquement — RLS enforce)
 * @param {string} agentId
 * @param {string} titleSlug  slug du titre (ex: 'archiviste')
 */
export async function setActiveTitle(agentId, titleSlug) {
  const { error } = await supabase
    .from('profiles')
    .update({ active_title: titleSlug })
    .eq('id', agentId);
  if (error) { console.error('[specialties] setActiveTitle:', error.message); return false; }
  return true;
}

// ─── HELPERS RENDU ────────────────────────────────────────────────────────────

const RARITY_STYLE = {
  common:    { color: '#9ca3af', label: 'COMMUN'    },
  rare:      { color: '#3b82f6', label: 'RARE'      },
  epic:      { color: '#8b5cf6', label: 'ÉPIQUE'    },
  legendary: { color: '#f59e0b', label: 'LÉGENDAIRE' },
};

/**
 * Génère le HTML d'un badge spécialité
 * @param {{ label_fr: string, icon: string, color: string }} specialty
 */
export function renderSpecialtyBadge(specialty) {
  if (!specialty) return '';
  return `<span class="specialty-badge" style="--badge-color:${specialty.color}">
    <span class="specialty-icon" aria-hidden="true">${specialty.icon ?? '⬡'}</span>
    <span class="specialty-label">${specialty.label_fr}</span>
  </span>`;
}

/**
 * Génère le HTML d'un badge titre
 * @param {{ label_fr: string, rarity: string }} title
 */
export function renderTitleBadge(title) {
  if (!title) return '';
  const r = RARITY_STYLE[title.rarity] ?? RARITY_STYLE.common;
  return `<span class="title-badge" style="--badge-color:${r.color}">
    <span class="title-rarity">${r.label}</span>
    <span class="title-label">${title.label_fr}</span>
  </span>`;
}

/**
 * Génère le HTML d'un sélecteur de spécialité (pour CIG edit)
 * @param {Array} specialties  liste depuis getSpecialties()
 * @param {string} currentId   specialty_id actuel du profil
 */
export function renderSpecialtySelector(specialties, currentId) {
  return `<select class="specialty-select" id="specialty-select" aria-label="Choisir sa spécialité">
    <option value="">-- Choisir une spécialité --</option>
    ${specialties
      .filter(s => s.is_selectable)
      .map(s => `<option value="${s.id}" ${s.id === currentId ? 'selected' : ''}>
        ${s.icon ?? ''} ${s.label_fr}
      </option>`)
      .join('')}
  </select>`;
}

/**
 * Génère le HTML de la liste des titres débloqués (pour CIG)
 * @param {Array} agentTitles  résultat de getAgentTitles()
 * @param {string} activeTitle  slug du titre actif
 */
export function renderTitlesList(agentTitles, activeTitle) {
  if (!agentTitles.length) {
    return `<p class="titles-empty">Aucun titre débloqué pour le moment.</p>`;
  }
  return `<ul class="titles-list">
    ${agentTitles.map(at => {
      const t = at.title;
      const r = RARITY_STYLE[t.rarity] ?? RARITY_STYLE.common;
      const isActive = t.slug === activeTitle;
      return `<li class="title-item ${isActive ? 'title-active' : ''}" data-slug="${t.slug}">
        <span class="title-rarity-dot" style="background:${r.color}" aria-hidden="true"></span>
        <span class="title-name">${t.label_fr}</span>
        <span class="title-rarity-label">${r.label}</span>
        ${isActive ? '<span class="title-active-tag">ACTIF</span>' : ''}
      </li>`;
    }).join('')}
  </ul>`;
}
