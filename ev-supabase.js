/**
 * ev-supabase.js — Engel & Völkers Mittleres Ruhrgebiet
 * Zentrale Datenbankschicht v2.0
 */

const SUPABASE_URL = 'https://pwkoxtyficedetiymgcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fQvTH65W8d6NTxX_KEp3SQ_SVU4YvGV';

// ── HTTP-KERN ────────────────────────────────────────────────────
async function _sbFetch(method, path, body, jwt) {
  const url = SUPABASE_URL + path;
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + (jwt || SUPABASE_KEY)
  };
  if (method === 'POST') headers['Prefer'] = 'return=minimal';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); msg = j.message || j.error_description || j.hint || msg; } catch(_) {}
    throw new Error(msg);
  }
  if (res.status === 204 || res.status === 201) return true;
  return res.json();
}

function _getJwt()      { return localStorage.getItem('ev_jwt') || null; }
function _setJwt(t)     { localStorage.setItem('ev_jwt', t); }
function _clearAuth()   { ['ev_jwt','ev_refresh','ev_user_meta'].forEach(k => localStorage.removeItem(k)); }

function _currentUser() {
  try { return JSON.parse(sessionStorage.getItem('evUser') || '{}'); } catch(_) { return {}; }
}
function _email() { return _currentUser().email || ''; }
function _name()  { return _currentUser().fullName || _currentUser().firstName || ''; }

// ── PUBLIC API ───────────────────────────────────────────────────
window.EvDB = {

  // AUTH
  async login(email, password) {
    const d = await _sbFetch('POST', '/auth/v1/token?grant_type=password', { email, password });
    if (!d || !d.access_token) throw new Error('Kein Token erhalten.');
    _setJwt(d.access_token);
    if (d.refresh_token) localStorage.setItem('ev_refresh', d.refresh_token);
    const user = _buildUser(d.user, email);
    localStorage.setItem('ev_user_meta', JSON.stringify(user));
    sessionStorage.setItem('evUser', JSON.stringify(user));
    return user;
  },

  async getCurrentUser() {
    const jwt = _getJwt();
    if (!jwt) return null;
    try {
      const d = await _sbFetch('GET', '/auth/v1/user', null, jwt);
      const user = _buildUser(d, d.email);
      sessionStorage.setItem('evUser', JSON.stringify(user));
      return user;
    } catch(e) { _clearAuth(); return null; }
  },

  async logout() {
    const jwt = _getJwt();
    if (jwt) { try { await _sbFetch('POST', '/auth/v1/logout', {}, jwt); } catch(_) {} }
    _clearAuth();
    sessionStorage.removeItem('evUser');
  },

  jwt() { return _getJwt(); },

  // ── WRITE HELPERS ──────────────────────────────────────────
  async _insert(table, row) {
    const jwt = _getJwt();
    if (!jwt) throw new Error('Nicht eingeloggt.');
    const result = await _sbFetch('POST', '/rest/v1/' + table, row, jwt);
    console.info('[E&V DB] ✓ Gespeichert in ' + table);
    return result;
  },

  async _select(table, query) {
    const jwt = _getJwt();
    if (!jwt) throw new Error('Nicht eingeloggt.');
    return _sbFetch('GET', '/rest/v1/' + table + '?' + query, null, jwt);
  },

  // ── WEEKLY CHECK-IN ────────────────────────────────────────
  async saveWeekly(data) {
    return this._insert('weekly_checkins', {
      user_name:     _name(),
      user_email:    _email(),
      kw:            data.kw            || null,
      jahr:          data.jahr          || null,
      rolle:         data.rolle         || null,
      score_pct:     data.scorePct      || null,
      score_note:    data.scoreNote     || null,
      antworten:     data.antworten     || {},
      offene_punkte: data.offenePunkte  || [],
      kommentare:    data.kommentare    || {}
    });
  },
  async getWeekly(limit = 500) {
    return this._select('weekly_checkins', 'select=*&order=created_at.desc&limit=' + limit);
  },

  // ── SOCIAL MEDIA ───────────────────────────────────────────
  async saveSocialMedia(data) {
    return this._insert('socialmedia_anfragen', {
      sender_name:    _name(),
      sender_email:   _email(),
      beitragsart:    data.beitragsart   || null,
      plattformen:    data.plattformen   || [],
      format:         data.format        || null,
      ton:            data.ton           || null,
      logo_variante:  data.logoVariante  || null,
      dringlichkeit:  data.dringlichkeit || null,
      inhalt:         data.inhalt        || null,
      objekt_details: data.objektDetails || null,
      anhaenge_anz:   data.anhaengeAnz   || 0,
      status:         'eingegangen'
    });
  },
  async getSocialMedia(limit = 200) {
    return this._select('socialmedia_anfragen', 'select=*&order=created_at.desc&limit=' + limit);
  },

  // ── FINANZIERUNG ───────────────────────────────────────────
  async saveFinanzierung(data) {
    return this._insert('finanzierung_anfragen', {
      berater_name:    _name(),
      berater_email:   _email(),
      referenz:        data.referenz       || null,
      kn1_name:        data.kn1_name       || null,
      kn1_gebdat:      data.kn1_gebdat     || null,
      kn1_adresse:     data.kn1_adresse    || null,
      kn1_email:       data.kn1_email      || null,
      kn1_tel:         data.kn1_tel        || null,
      kn1_beschaeft:   data.kn1_beschaeft  || null,
      kn1_netto:       parseFloat(data.kn1_netto)  || null,
      kn2_name:        data.kn2_name       || null,
      kn2_netto:       parseFloat(data.kn2_netto)  || null,
      obj_art:         data.obj_art        || null,
      obj_adresse:     data.obj_adresse    || null,
      obj_kaufpreis:   parseFloat(data.obj_kaufpreis)  || null,
      obj_baujahr:     parseInt(data.obj_baujahr)      || null,
      obj_nutzung:     data.obj_nutzung    || null,
      obj_wohnfl:      parseFloat(data.obj_wohnfl)     || null,
      obj_energie_kl:  data.obj_energie_kl || null,
      fin_ek:          parseFloat(data.fin_ek)         || null,
      fin_ek_quote:    parseFloat(data.fin_ek_quote)   || null,
      fin_darlehen:    parseFloat(data.fin_darlehen)   || null,
      fin_gesamt:      parseFloat(data.fin_gesamt)     || null,
      fin_zinsbindung: parseInt(data.fin_zinsbindung)  || null,
      fin_tilgung:     parseFloat(data.fin_tilgung)    || null,
      fin_sondertilg:  data.fin_sondertilg || null,
      foerderungen:    data.foerderungen   || null,
      zielbank:        data.zielbank       || null,
      status:          'gesendet'
    });
  },
  async getFinanzierungen(limit = 200) {
    return this._select('finanzierung_anfragen', 'select=*&order=created_at.desc&limit=' + limit);
  },

  // ── BRAND SHOP ─────────────────────────────────────────────
  async saveOrder(order) {
    return this._insert('shop_orders', {
      order_number: order.id             || null,
      user_email:   _email(),
      user_name:    _name(),
      items:        order.items          || [],
      total_eur:    parseFloat(order.total) || 0,
      status:       order.status         || 'approved',
      location:     order.location       || null,
      cost_center:  order.costCenter     || null,
      project_ref:  order.projectRef     || null,
      notes:        order.notes          || null,
      over_budget:  order.overBudget     || false
    });
  },
  async getOrders(limit = 200) {
    return this._select('shop_orders', 'select=*&order=created_at.desc&limit=' + limit);
  },

  // ── ADMIN STATS ────────────────────────────────────────────
  async getAdminStats() {
    const [orders, finanz, weekly, social] = await Promise.allSettled([
      this.getOrders(500),
      this.getFinanzierungen(500),
      this.getWeekly(500),
      this.getSocialMedia(500)
    ]);
    return {
      orders:      orders.status === 'fulfilled' && Array.isArray(orders.value)      ? orders.value      : [],
      finanz:      finanz.status === 'fulfilled' && Array.isArray(finanz.value)      ? finanz.value      : [],
      weekly:      weekly.status === 'fulfilled' && Array.isArray(weekly.value)      ? weekly.value      : [],
      socialmedia: social.status === 'fulfilled' && Array.isArray(social.value)      ? social.value      : []
    };
  }
};

// ── USER BUILDER ─────────────────────────────────────────────────
function _buildUser(u, email) {
  const m = u.user_metadata || {};
  const raw = m.full_name || m.name || email.split('@')[0].replace(/[._]/g, ' ');
  const parts = raw.trim().split(' ');
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  return {
    id:        u.id,
    email:     email,
    fullName:  parts.map(cap).join(' '),
    firstName: cap(parts[0]) || '',
    lastName:  parts.slice(1).map(cap).join(' ') || '',
    initials:  parts.map(p => p[0]?.toUpperCase() || '').join('').substring(0,2) || 'EV',
    role:      m.role || 'berater'
  };
}

console.info('%c[E&V] Supabase verbunden ✓ — ' + SUPABASE_URL, 'color:#2d7a4f;font-weight:bold');

window.EV_SUPABASE_URL      = "https://pwkoxtyficedetiymgcj.supabase.co";
window.EV_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3a294dHlmaWNlZGV0aXltZ2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDk0NjcsImV4cCI6MjA5NDQyNTQ2N30.IpVLujVUsJgrSm9xKEwZuuO8PlrgugBBUbFs_z0-Lx8";

/* ============================================================
 *  ev-supabase.js — Ergänzung: EvDB.saveFinanzierung
 * ------------------------------------------------------------
 *  Diese Funktion in dein bestehendes ev-supabase.js einfügen
 *  (in dasselbe EvDB-Objekt, in dem auch saveSocialMedia liegt).
 *
 *  Voraussetzung: window.EV_SUPABASE_URL und
 *  window.EV_SUPABASE_ANON_KEY sind gesetzt (siehe SETUP.md),
 *  und der Supabase-Client ist als window.evSupabase verfügbar
 *  ODER es wird direkt per REST geschrieben (Variante unten).
 * ============================================================ */

/* --- Variante A: wenn ihr bereits einen Supabase-JS-Client habt ---
 * (z. B. window.evSupabase = supabase.createClient(url, anonKey))
 */
async function saveFinanzierung_clientVariante(data) {
  const { error } = await window.evSupabase
    .from('finanzierungsanfragen')
    .insert([data]);
  if (error) throw new Error(error.message);
  return true;
}

/* --- Variante B: ohne Client, direkt über die REST-API ---
 * Funktioniert mit nur URL + Anon-Key, kein zusätzliches SDK nötig.
 * Diese Variante wird unten in EvDB verdrahtet.
 */
async function saveFinanzierung_restVariante(data) {
  const url  = (window.EV_SUPABASE_URL || '').replace(/\/$/, '');
  const key  = window.EV_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('Supabase URL/Anon-Key nicht konfiguriert');

  const res = await fetch(url + '/rest/v1/finanzierungsanfragen', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify([data])
  });

  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (_) {}
    throw new Error(msg);
  }
  return true;
}

/* --- In EvDB einhängen ---
 * Falls EvDB schon existiert, nur die Methode ergänzen:
 */
window.EvDB = window.EvDB || {};
window.EvDB.saveFinanzierung = async function (data) {
  // Variante B (REST) als Default — robust, ohne SDK-Abhängigkeit.
  // Wenn ihr lieber den Client nutzt: Zeile unten austauschen gegen
  // return saveFinanzierung_clientVariante(data);
  return saveFinanzierung_restVariante(data);
};
