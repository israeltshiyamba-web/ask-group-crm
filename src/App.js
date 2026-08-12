import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// ASK GROUP SARL — CRM DE SUIVI DES RENDEZ-VOUS CLIENTS
// Direction artistique : "console de suivi d'appels", thème sombre,
// accent bleu signal, pipeline visualisé comme une ligne d'appel.
// ============================================================

const SUPABASE_URL = "https://sfuuzluaysxrdcqtvuto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdXV6bHVheXN4cmRjcXR2dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTU2OTEsImV4cCI6MjA5NzU5MTY5MX0.2N6_dYs56LLV6hLLkxippeyxrMNSp9VlBUt_GUdEdcM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Tokens de design ────────────────────────────────────────
const BG = "#0B0D12";
const SURFACE = "#1D2029";
const LINE = "rgba(255,255,255,.08)";
const TEXT = "#F5F6F8";
const TEXT_MUTED = "#7B8194";
const SIGNAL = "#2D6CDF";
const APP_NAME_ADMIN = "crm_admin";

const STATUTS = [
  { key: "nouveau", label: "Nouveau rendez-vous à traiter", color: "#8890A6", bg: "rgba(136,144,166,.14)" },
  { key: "confirme", label: "Confirmé", color: "#2D6CDF", bg: "rgba(45,108,223,.14)" },
  { key: "documents", label: "Documents reçus", color: "#4FB8D9", bg: "rgba(79,184,217,.14)" },
  { key: "programme", label: "Programmé installation", color: "#7A5FC7", bg: "rgba(122,95,199,.14)" },
  { key: "installe", label: "Installé", color: "#0FA98F", bg: "rgba(15,169,143,.14)" },
  { key: "rappeler", label: "À rappeler", color: "#C4821E", bg: "rgba(196,130,30,.14)" },
  { key: "annule", label: "Annulé / Perdu", color: "#C43D46", bg: "rgba(196,61,70,.14)" },
];
function statutInfo(key) { return STATUTS.find(s => s.key === key) || STATUTS[0]; }
const STATUTS_CHAINE = STATUTS.filter(s => s.key !== "annule" && s.key !== "rappeler");

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Champs fixes du formulaire client (définis par la Direction, non modifiables par l'agent) ───
const FIELDS_COORDONNEES = [
  { key: "nomClient", label: "Nom et Prénom" },
  { key: "telephone", label: "Téléphone" },
  { key: "adresse", label: "Adresse" },
  { key: "mail", label: "Mail" },
];
const FIELDS_CONFIG = {
  "GÉNÉRALITÉS": [
    { key: "residencePrincipale", label: "Résidence principale" },
    { key: "surfaceHabitable", label: "Surface habitable" },
    { key: "modeChauffage", label: "Mode de chauffage" },
    { key: "complementChauffage", label: "Complément de chauffage" },
    { key: "emplacementChaudiere", label: "Emplacement de la chaudière" },
    { key: "eauChaudeSanitaire", label: "Eau chaude des sanitaires" },
    { key: "anneeConstruction", label: "Année de construction" },
    { key: "compteMPR", label: "Compte MPR" },
  ],
  "DÉTAILS ISOLATION": [
    { key: "combles", label: "Combles" },
    { key: "sousSol", label: "Sous-sol" },
    { key: "isolationExterieure", label: "Isolation extérieure" },
    { key: "isolationInterieure", label: "Isolation intérieure" },
    { key: "fenetres", label: "Fenêtres" },
    { key: "vmc", label: "VMC" },
  ],
  "ACTEURS ÉNERGÉTIQUE": [
    { key: "nombrePersonnes", label: "Nombre de personnes" },
    { key: "nombreEnfants", label: "Nombre d'enfants à charge" },
    { key: "revenuFiscal", label: "Revenu fiscal de référence" },
    { key: "categorie", label: "Catégorie" },
    { key: "ressentiClient", label: "Ressenti client" },
    { key: "codeDossier", label: "Code du dossier" },
  ],
};
const EMPTY_CONFIG = Object.values(FIELDS_CONFIG).flat().reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});
function parseConfig(str) {
  try { return { ...EMPTY_CONFIG, ...(str ? JSON.parse(str) : {}) }; }
  catch { return { ...EMPTY_CONFIG }; }
}
function countFilled(obj, keys) { return keys.filter(k => obj[k] && String(obj[k]).trim()).length; }

// ============================================================
// PRIME DE PERFORMANCE — calculée dans le CRM
// Prime basique (25$, mensuelle, 3 conditions) + surprimes (cumulatives, tout temps)
// Le % de temps travaillé et la prime d'assiduité sont saisis manuellement par la
// Direction (lus depuis le Suivi RH), pas de connexion directe entre les 2 logiciels.
// ============================================================
const PRIME_BASIQUE_MONTANT = 25;
const SURPRIME_DOCUMENTS = 5;
const SURPRIME_INSTALLATION = 50;

function mkOf(d) { return (d || "1970-01-01").slice(0, 7); }
function prevMonthKey(mk) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Calcule les primes d'UN SEUL mois donné (sans tenir compte des mois non versés précédents)
function calcPrimePerformance(agent, tousLesClientsAgent, donneesRH, mk) {
  const clientsDuMois = tousLesClientsAgent.filter(c => mkOf(c.created_at) === mk);
  const nbRdv = clientsDuMois.length;
  const juges = clientsDuMois.filter(c => c.qualite === "valide" || c.qualite === "non_valide");
  const valides = clientsDuMois.filter(c => c.qualite === "valide");
  const tauxQualite = juges.length > 0 ? (valides.length / juges.length) * 100 : 0;
  const donnee = donneesRH.find(d => d.agentId === agent.id && d.mois === mk) || { pourcentageTempsTravaille: 0, primeAssiduite: 0, primeVersee: false };
  const ratioTravail = donnee.pourcentageTempsTravaille || 0;
  const primeAssiduite = donnee.primeAssiduite || 0;
  const primeVersee = !!donnee.primeVersee;

  const cond1 = nbRdv >= 18;
  const cond2 = juges.length > 0 && tauxQualite >= 80;
  const cond3 = ratioTravail >= 90;
  const primeBasiqueEligible = cond1 && cond2 && cond3;
  const primeBasique = primeBasiqueEligible ? PRIME_BASIQUE_MONTANT : 0;

  // Surprimes DU MOIS : basées sur la date exacte du changement de statut (pas la date du rendez-vous)
  const nbDocuments = tousLesClientsAgent.filter(c => c.documentsDate && mkOf(c.documentsDate) === mk).length;
  const nbInstalles = tousLesClientsAgent.filter(c => c.installeDate && mkOf(c.installeDate) === mk).length;
  const surprimeDocuments = nbDocuments * SURPRIME_DOCUMENTS;
  const surprimeInstallation = nbInstalles * SURPRIME_INSTALLATION;
  const totalSurprimesMois = surprimeDocuments + surprimeInstallation;
  const totalMoisPropre = primeBasique + totalSurprimesMois + primeAssiduite;

  return {
    nbRdv, tauxQualite, juges: juges.length, valides: valides.length, ratioTravail,
    cond1, cond2, cond3, primeBasiqueEligible, primeBasique,
    nbDocuments, surprimeDocuments, nbInstalles, surprimeInstallation, totalSurprimesMois,
    primeAssiduite, primeVersee, totalMoisPropre,
  };
}

// Total réellement dû pour le mois consulté = son propre total + tout arriéré des mois
// précédents non encore marqués "versés" (s'arrête dès qu'un mois versé est rencontré)
function calcTotalAvecReport(agent, tousLesClientsAgent, donneesRH, mk) {
  let total = 0;
  const moisEnRetard = [];
  let cursor = mk;
  for (let i = 0; i < 24; i++) {
    const p = calcPrimePerformance(agent, tousLesClientsAgent, donneesRH, cursor);
    if (i === 0) {
      total += p.totalMoisPropre;
    } else {
      if (p.primeVersee) break;
      total += p.totalMoisPropre;
      if (p.totalMoisPropre > 0) moisEnRetard.push(cursor);
    }
    cursor = prevMonthKey(cursor);
  }
  return { total, moisEnRetard };
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');`;
const FONT_DISPLAY = "'Poppins', sans-serif";
const FONT_BODY = "'Inter', 'Segoe UI', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const GLOBAL_CSS = `
${FONT_IMPORT}
.askg-page-frame { position:fixed; inset:8px; border-radius:22px; border:1px solid transparent; background: linear-gradient(90deg,#2D6CDF,#0FA98F,#7A5FC7,#2D6CDF) border-box; -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; background-size:300% 100%; animation: askgFrameFlow 8s linear infinite; opacity:.28; pointer-events:none; z-index:80; }
@keyframes askgFrameFlow { to { background-position:300% 0; } }
@keyframes askgFloat { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(30px,-24px) scale(1.08); } }
@keyframes askgWave { 0%,100% { height:8px; } 50% { height:42px; } }
@keyframes askgPulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
@keyframes askgCardIn { from { opacity:0; transform:translateY(22px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes askgFadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes askgPageIn { from { opacity:0; transform:translateY(18px) scale(.99); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes askgRevealUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
@keyframes askgKateIn { 0% { opacity:0; transform:translateY(30px) scale(.85); letter-spacing:14px; } 60% { opacity:1; } 100% { opacity:1; transform:translateY(0) scale(1); letter-spacing:2px; } }
@keyframes askgBob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
@keyframes askgSlideRight { from{opacity:0; transform:translateX(40px);} to{opacity:1; transform:translateX(0);} }
@keyframes askgRowIn { from{opacity:0; transform:translateX(-10px);} to{opacity:1; transform:translateX(0);} }
@keyframes askgRipple { to { transform:scale(3); opacity:0; } }
@keyframes askgBounce { 0%{transform:scale(1);} 40%{transform:scale(1.16);} 100%{transform:scale(1);} }
@keyframes askgFloaty { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
@keyframes askgNodePulse { 0%,100%{box-shadow:0 0 0 4px rgba(15,169,143,.22);} 50%{box-shadow:0 0 0 7px rgba(15,169,143,.08);} }
@keyframes askgLineFill { to { transform:scaleX(1); } }
.askg-ripple { position:absolute; border-radius:50%; background:rgba(255,255,255,.5); transform:scale(0); animation: askgRipple .6s ease-out; pointer-events:none; }
.askg-kpi:hover, .askg-client-card:hover { transform:translateY(-2px); border-color:rgba(45,108,223,.4) !important; }
.askg-tbl-row:hover { background:rgba(45,108,223,.07) !important; }
.askg-tbl th.sortable:hover { color:${TEXT} !important; }
.askg-badge:active { transform:scale(.9); }
.askg-btn { transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease, background .2s ease, filter .2s ease; }
.askg-btn:active { transform:scale(.94); }
.askg-btn:hover { filter:brightness(1.12); transform:translateY(-1px); }
.askg-btn-primary:hover { box-shadow:0 14px 34px rgba(45,108,223,.5) !important; transform:translateY(-2px); }
.askg-kpi, .askg-client-card { transition: transform .25s cubic-bezier(.34,1.56,.64,1), border-color .2s ease, box-shadow .2s ease; }
.askg-kpi:hover { box-shadow: 0 10px 26px rgba(0,0,0,.3); }
.askg-nav-item:hover { color:${TEXT} !important; }
@media (max-width: 768px) {
  .askg-shell { flex-direction: column !important; }
  .askg-sidebar { width: 100% !important; padding: 12px 0 !important; }
  .askg-sidebar-header { padding: 0 16px 12px !important; margin-bottom: 8px !important; }
  .askg-sidebar-nav { display: flex !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; padding: 0 8px !important; }
  .askg-sidebar-nav > div { white-space: nowrap !important; padding: 8px 14px !important; border-left: none !important; border-bottom: 3px solid transparent !important; }
  .askg-main { padding: 14px !important; }
  table { font-size: 11px !important; }
  h1 { font-size: 18px !important; }
}
`;

function ripple(e) {
  const btn = e.currentTarget;
  const circle = document.createElement('span');
  circle.className = 'askg-ripple';
  const rect = btn.getBoundingClientRect();
  const size = 120;
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (e.clientX - rect.left - size / 2) + 'px';
  circle.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

// ============================================================
// COMPOSANT — Illustration agente (casque, sans traits de visage)
// ============================================================
// ============================================================
// COMPOSANT — Plateau de centre d'appel (silhouette animée, fond de l'écran Kate)
// ============================================================
function CallFloorIllustration() {
  const positions = [
    { x: 155, y: 222, hc: SIGNAL, delay: "0s" },
    { x: 375, y: 212, hc: "#7A5FC7", delay: ".6s" },
    { x: 625, y: 227, hc: "#0FA98F", delay: "1.1s" },
    { x: 855, y: 214, hc: "#4FB8D9", delay: ".3s" },
    { x: 1055, y: 230, hc: SIGNAL, delay: ".85s" },
  ];
  return (
    <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "38%", opacity: .32 }}>
      <defs>
        <g id="askgAgentFig">
          <rect x="-42" y="30" width="84" height="20" rx="4" fill="#12141A" />
          <rect x="-30" y="-4" width="60" height="36" rx="6" fill={SURFACE} />
          <rect x="-25" y="-1" width="50" height="24" rx="3" fill="#161822" />
          <circle cx="0" cy="-32" r="24" fill="#241925" />
          <path d="M-20 -36 Q-24 -62 0 -68 Q24 -62 20 -36" fill="none" stroke="var(--hc)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="-22" cy="-34" r="7" fill="var(--hc)" />
          <circle cx="22" cy="-34" r="7" fill="var(--hc)" />
          <path d="M22 -28 Q30 -18 22 -8 L16 -3" fill="none" stroke="var(--hc)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="15" cy="-2" r="4" fill="var(--hc)" />
        </g>
      </defs>
      {positions.map((p, i) => (
        <g key={i} transform={`translate(${p.x},${p.y})`}>
          <g style={{ animation: `askgBob 3.4s ease-in-out infinite`, animationDelay: p.delay, "--hc": p.hc }}>
            <use href="#askgAgentFig" />
          </g>
        </g>
      ))}
    </svg>
  );
}

function AgentIllustration({ size = 220 }) {
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(45,108,223,.3)", animation: "askgFloat 5s ease-in-out infinite" }} />
      <svg viewBox="0 0 320 320" width={size} height={size}>
        <path d="M20 250 Q10 140 70 60 Q140 -20 230 30 Q305 70 300 160 Q295 260 210 300 Q120 335 55 290 Q25 270 20 250 Z" fill={SURFACE} />
        <path d="M104 314 Q104 240 190 240 Q276 240 276 314 Z" fill="#0FA98F" />
        <path d="M128 254 L252 254 L240 314 L140 314 Z" fill="#0B7A65" />
        <circle cx="140" cy="270" r="6" fill="#F5F6F8" opacity=".9" />
        <circle cx="164" cy="286" r="6" fill="#F5F6F8" opacity=".9" />
        <circle cx="140" cy="302" r="6" fill="#F5F6F8" opacity=".9" />
        <g>
          <circle cx="190" cy="150" r="90" fill="#241925" />
          <circle cx="134" cy="118" r="30" fill="#241925" />
          <circle cx="112" cy="148" r="27" fill="#241925" />
          <circle cx="108" cy="184" r="24" fill="#241925" />
          <circle cx="124" cy="214" r="20" fill="#241925" />
          <circle cx="246" cy="118" r="30" fill="#241925" />
          <circle cx="266" cy="148" r="27" fill="#241925" />
          <circle cx="270" cy="184" r="24" fill="#241925" />
          <circle cx="254" cy="214" r="20" fill="#241925" />
          <circle cx="190" cy="84" r="35" fill="#241925" />
          <circle cx="158" cy="92" r="26" fill="#2E2030" />
          <circle cx="222" cy="92" r="26" fill="#2E2030" />
        </g>
        <ellipse cx="190" cy="158" rx="60" ry="64" fill="#8A5A3F" />
        <circle cx="152" cy="150" r="14" fill="#8A5A3F" />
        <circle cx="228" cy="150" r="14" fill="#8A5A3F" />
        <path d="M114 148 Q108 90 190 82 Q272 90 266 148" fill="none" stroke={SIGNAL} strokeWidth="9" strokeLinecap="round" />
        <circle cx="114" cy="158" r="17" fill={SIGNAL} />
        <circle cx="266" cy="158" r="17" fill={SIGNAL} />
        <path d="M266 172 Q280 190 266 204 L254 214" fill="none" stroke={SIGNAL} strokeWidth="7" strokeLinecap="round" />
        <circle cx="252" cy="216" r="7.5" fill={SIGNAL} />
        <ellipse cx="164" cy="152" rx="23" ry="19" fill="rgba(45,108,223,.12)" stroke="#12141A" strokeWidth="4" />
        <ellipse cx="216" cy="152" rx="23" ry="19" fill="rgba(45,108,223,.12)" stroke="#12141A" strokeWidth="4" />
        <path d="M187 150 Q190 146 193 150" fill="none" stroke="#12141A" strokeWidth="4" strokeLinecap="round" />
        <path d="M141 148 Q128 146 120 152" fill="none" stroke="#12141A" strokeWidth="4" strokeLinecap="round" />
        <path d="M239 148 Q252 146 260 152" fill="none" stroke="#12141A" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", top: 2, right: 4, background: "#0FA98F", color: "white", width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, boxShadow: "0 8px 20px rgba(15,169,143,.4)", animation: "askgFloaty 3.2s ease-in-out infinite" }}>✓</div>
      <div style={{ position: "absolute", bottom: 18, left: -2, background: SURFACE, border: "1px solid " + LINE, width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, boxShadow: "0 8px 20px rgba(0,0,0,.4)", animation: "askgFloaty 3.2s ease-in-out infinite 1s" }}>📞</div>
    </div>
  );
}

function EnergyIcons() {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 22, opacity: .75 }}>
      <svg width="46" height="46" viewBox="0 0 60 60" style={{ animation: "askgFloaty 3.6s ease-in-out infinite" }}><path d="M30 8 L52 26 L46 26 L46 50 L14 50 L14 26 L8 26 Z" fill="none" stroke={SIGNAL} strokeWidth="3" strokeLinejoin="round" /><rect x="24" y="26" width="16" height="5" rx="1.5" fill="#0FA98F" /><rect x="24" y="33" width="13" height="5" rx="1.5" fill="#C4821E" /><rect x="24" y="40" width="10" height="5" rx="1.5" fill="#C43D46" /></svg>
      <svg width="46" height="46" viewBox="0 0 60 60" style={{ animation: "askgFloaty 3.6s ease-in-out infinite .5s" }}><rect x="8" y="16" width="30" height="22" rx="4" fill="none" stroke="#0FA98F" strokeWidth="3" /><circle cx="23" cy="27" r="8" fill="none" stroke="#0FA98F" strokeWidth="2.4" /><path d="M23 21 Q27 27 23 33 Q19 27 23 21" fill="#0FA98F" /><line x1="42" y1="27" x2="54" y2="27" stroke="#0FA98F" strokeWidth="3" strokeLinecap="round" /></svg>
      <svg width="46" height="46" viewBox="0 0 60 60" style={{ animation: "askgFloaty 3.6s ease-in-out infinite 1s" }}><path d="M12 30 L30 14 L48 30 L48 50 L12 50 Z" fill="none" stroke="#7A5FC7" strokeWidth="3" strokeLinejoin="round" /><rect x="18" y="16" width="20" height="10" rx="1.5" fill="#7A5FC7" opacity=".8" transform="rotate(-32 30 21)" /><circle cx="47" cy="12" r="5" fill="#C4821E" /></svg>
    </div>
  );
}

function BgGlow({ opacity = 1 }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity }}>
      <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", filter: "blur(70px)", opacity: .3, background: SIGNAL, top: -140, left: -100, animation: "askgFloat 14s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", filter: "blur(70px)", opacity: .3, background: "#7A5FC7", bottom: -110, right: -70, animation: "askgFloat 18s ease-in-out infinite -4s" }} />
      <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", filter: "blur(70px)", opacity: .3, background: "#0FA98F", top: "40%", left: "60%", animation: "askgFloat 16s ease-in-out infinite -8s" }} />
    </div>
  );
}

function Waveform({ pos }) {
  const bars = Array.from({ length: 36 });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, [pos]: 0, height: 80, display: "flex", alignItems: pos === "top" ? "flex-start" : "flex-end", justifyContent: "center", gap: 4, opacity: .35, pointerEvents: "none" }}>
      {bars.map((_, i) => (
        <span key={i} style={{ width: 4, borderRadius: 4, background: pos === "top" ? "linear-gradient(0deg,#0FA98F,transparent)" : "linear-gradient(180deg,#2D6CDF,transparent)", height: 10 + Math.random() * 20, animation: `askgWave 1.4s ease-in-out infinite`, animationDelay: (Math.random() * 1.4) + "s" }} />
      ))}
    </div>
  );
}

// ============================================================
// MODAL — pop-up réutilisable pour Coordonnées / Configuration maison
// ============================================================
function PasswordInput({ value, onChange, placeholder, style, onKeyDown, autoFocus, centered }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="new-password"
        style={{ ...style, width: "100%", boxSizing: "border-box", paddingRight: 38 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        style={{ position: "absolute", right: centered ? 12 : 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TEXT_MUTED, fontSize: 15, padding: 4 }}
      >{show ? "🙈" : "👁"}</button>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "askgPulse .01s" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, width: 520, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 30px 80px rgba(0,0,0,.5)", animation: "askgCardIn .3s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ position: "sticky", top: 0, background: SURFACE, padding: "16px 20px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, margin: 0, fontWeight: 600, color: TEXT, fontFamily: FONT_DISPLAY }}>{title}</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.08)", border: "none", color: TEXT, width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function CoordonneesModal({ values, onChange, onClose, readOnly }) {
  return (
    <Modal title="📇 Coordonnées client" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FIELDS_COORDONNEES.map(f => (
          <div key={f.key}>
            <label style={darkLabelStyle}>{f.label}</label>
            {readOnly
              ? <div style={{ fontSize: 13, color: TEXT, padding: "8px 0" }}>{values[f.key] || <span style={{ color: TEXT_MUTED }}>—</span>}</div>
              : <input type="text" value={values[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} style={darkInputStyle} />}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ConfigMaisonModal({ values, onChange, onClose, readOnly }) {
  return (
    <Modal title="🏠 Configuration de la maison" onClose={onClose}>
      {Object.entries(FIELDS_CONFIG).map(([section, fields]) => (
        <div key={section} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7A5FC7", letterSpacing: 1, textDecoration: "underline", textUnderlineOffset: 4, marginBottom: 12 }}>{section}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={darkLabelStyle}>{f.label}</label>
                {readOnly
                  ? <div style={{ fontSize: 13, color: TEXT, padding: "8px 0" }}>{values[f.key] || <span style={{ color: TEXT_MUTED }}>—</span>}</div>
                  : <input type="text" value={values[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} style={darkInputStyle} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

// ============================================================
// MODALES ADMIN — consultation + modification (Coordonnées / Config maison)
// Toute modification se répercute immédiatement chez l'agent (base partagée)
// ============================================================
function AdminCoordonneesModal({ client, onSave, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ nomClient: client.nomClient || "", telephone: client.telephone || "", adresse: client.adresse || "", mail: client.mail || "" });
  function save() { onSave(draft); setEditing(false); }
  return (
    <Modal title="📇 Coordonnées client" onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        {editing ? (
          <>
            <button className="askg-btn" onClick={(e) => { ripple(e); save(); }} style={primaryBtnStyle}>Enregistrer</button>
            <button className="askg-btn" onClick={(e) => { ripple(e); setEditing(false); }} style={ghostBtnStyle}>Annuler</button>
          </>
        ) : (
          <button className="askg-btn" onClick={(e) => { ripple(e); setEditing(true); }} style={editBtnStyle}>Modifier</button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FIELDS_COORDONNEES.map(f => (
          <div key={f.key}>
            <label style={darkLabelStyle}>{f.label}</label>
            {editing
              ? <input type="text" value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} style={darkInputStyle} />
              : <div style={{ fontSize: 13, color: TEXT, padding: "8px 0" }}>{draft[f.key] || <span style={{ color: TEXT_MUTED }}>—</span>}</div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function AdminConfigMaisonModal({ client, onSave, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parseConfig(client.configurationMaison));
  function save() { onSave(draft); setEditing(false); }
  return (
    <Modal title="🏠 Configuration de la maison" onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        {editing ? (
          <>
            <button className="askg-btn" onClick={(e) => { ripple(e); save(); }} style={primaryBtnStyle}>Enregistrer</button>
            <button className="askg-btn" onClick={(e) => { ripple(e); setEditing(false); }} style={ghostBtnStyle}>Annuler</button>
          </>
        ) : (
          <button className="askg-btn" onClick={(e) => { ripple(e); setEditing(true); }} style={editBtnStyle}>Modifier</button>
        )}
      </div>
      {Object.entries(FIELDS_CONFIG).map(([section, fields]) => (
        <div key={section} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7A5FC7", letterSpacing: 1, textDecoration: "underline", textUnderlineOffset: 4, marginBottom: 12 }}>{section}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={darkLabelStyle}>{f.label}</label>
                {editing
                  ? <input type="text" value={draft[f.key] || ""} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} style={darkInputStyle} />
                  : <div style={{ fontSize: 13, color: TEXT, padding: "8px 0" }}>{draft[f.key] || <span style={{ color: TEXT_MUTED }}>—</span>}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

function SignalChain({ current }) {
  const isBranch = current === "annule" || current === "rappeler";
  const idx = isBranch ? STATUTS_CHAINE.length - 1 : STATUTS_CHAINE.findIndex(s => s.key === current);
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {STATUTS_CHAINE.map((s, i) => {
        const active = !isBranch && i <= idx;
        const isCurrent = !isBranch && i === idx;
        return (
          <React.Fragment key={s.key}>
            <span style={{
              width: isCurrent ? 12 : 8, height: isCurrent ? 12 : 8, borderRadius: 99, flexShrink: 0,
              background: active ? s.color : "#3A3E4C",
              boxShadow: isCurrent ? `0 0 0 4px ${s.bg}` : "none",
              animation: isCurrent ? "askgNodePulse 1.6s ease-in-out infinite" : "none",
            }} />
            {i < STATUTS_CHAINE.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 4px", background: active && i < idx ? s.color : "#2A2E3A" }} />}
          </React.Fragment>
        );
      })}
      {isBranch && <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, color: statutInfo(current).color, background: statutInfo(current).bg, padding: "3px 8px", borderRadius: 6 }}>{statutInfo(current).label.toUpperCase()}</span>}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState(null);
  const [splashDone, setSplashDone] = useState(false);
  const [agents, setAgents] = useState([]);
  const [clients, setClients] = useState([]);
  const [codes, setCodes] = useState([]);
  const [donneesRH, setDonneesRH] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [agentConnecte, setAgentConnecte] = useState(null);
  const [adminConnecte, setAdminConnecte] = useState(false);
  const [adminStoredPw, setAdminStoredPw] = useState(null);
  const [adminSetupMode, setAdminSetupMode] = useState(false);

  useEffect(() => {
    async function loadAll() {
      const [a, c, cd, pw, rh] = await Promise.all([
        supabase.from("agents").select("*").order("created_at"),
        supabase.from("crm_clients").select("*").order("created_at", { ascending: false }),
        supabase.from("crm_agent_codes").select("*"),
        supabase.from("app_passwords").select("*").eq("app_name", APP_NAME_ADMIN).maybeSingle(),
        supabase.from("crm_donnees_rh_mensuelles").select("*"),
      ]);
      if (a.data) setAgents(a.data);
      if (c.data) setClients(c.data.map(x => ({ ...x, agentId: x.agent_id, nomClient: x.nom_client, dateRdv: x.date_rdv, raisonAnnulation: x.raison_annulation, rappelDate: x.rappel_date, rappelCommentaire: x.rappel_commentaire, configurationMaison: x.configuration_maison, qualite: x.qualite, documentsDate: x.documents_date, installeDate: x.installe_date })));
      if (cd.data) setCodes(cd.data.map(x => ({ ...x, agentId: x.agent_id })));
      if (pw.data) setAdminStoredPw(pw.data.password);
      else setAdminSetupMode(true);
      if (rh.data) setDonneesRH(rh.data.map(x => ({ agentId: x.agent_id, mois: x.mois, pourcentageTempsTravaille: x.pourcentage_temps_travaille, primeAssiduite: x.prime_assiduite, primeVersee: x.prime_versee })));
      setLoaded(true);
    }
    loadAll();
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  }, []);

  async function addClient(form) {
    const newRow = { id: uid(), agentId: agentConnecte.id, nomClient: form.nomClient, telephone: form.telephone, adresse: form.adresse, mail: form.mail, produit: form.produit, dateRdv: form.dateRdv, statut: "nouveau", notes: form.notes, configurationMaison: form.configurationMaison, created_at: new Date().toISOString() };
    setClients(prev => [newRow, ...prev]);
    await supabase.from("crm_clients").insert({ id: newRow.id, agent_id: newRow.agentId, nom_client: newRow.nomClient, telephone: newRow.telephone, adresse: newRow.adresse, mail: newRow.mail, produit: newRow.produit, date_rdv: newRow.dateRdv || null, statut: "nouveau", notes: newRow.notes, configuration_maison: newRow.configurationMaison });
  }
  async function updateClient(id, updates) {
    // Horodatage automatique la 1ère fois qu'un client atteint "documents" ou "installé"
    // (sert à rattacher les surprimes au mois exact du changement, jamais réécrit ensuite)
    const current = clients.find(c => c.id === id);
    const autoStamps = {};
    if (updates.statut === "documents" && current && !current.documentsDate) autoStamps.documentsDate = new Date().toISOString();
    if (updates.statut === "installe" && current && !current.installeDate) autoStamps.installeDate = new Date().toISOString();
    const fullUpdates = { ...updates, ...autoStamps };
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...fullUpdates } : c));
    const dbUpdates = {};
    if ("nomClient" in fullUpdates) dbUpdates.nom_client = fullUpdates.nomClient;
    if ("telephone" in fullUpdates) dbUpdates.telephone = fullUpdates.telephone;
    if ("adresse" in fullUpdates) dbUpdates.adresse = fullUpdates.adresse;
    if ("mail" in fullUpdates) dbUpdates.mail = fullUpdates.mail;
    if ("produit" in fullUpdates) dbUpdates.produit = fullUpdates.produit;
    if ("dateRdv" in fullUpdates) dbUpdates.date_rdv = fullUpdates.dateRdv || null;
    if ("statut" in fullUpdates) dbUpdates.statut = fullUpdates.statut;
    if ("notes" in fullUpdates) dbUpdates.notes = fullUpdates.notes;
    if ("configurationMaison" in fullUpdates) dbUpdates.configuration_maison = fullUpdates.configurationMaison;
    if ("raisonAnnulation" in fullUpdates) dbUpdates.raison_annulation = fullUpdates.raisonAnnulation;
    if ("rappelDate" in fullUpdates) dbUpdates.rappel_date = fullUpdates.rappelDate || null;
    if ("rappelCommentaire" in fullUpdates) dbUpdates.rappel_commentaire = fullUpdates.rappelCommentaire;
    if ("documentsDate" in fullUpdates) dbUpdates.documents_date = fullUpdates.documentsDate;
    if ("installeDate" in fullUpdates) dbUpdates.installe_date = fullUpdates.installeDate;
    await supabase.from("crm_clients").update(dbUpdates).eq("id", id);
  }
  async function removeClient(id) {
    setClients(prev => prev.filter(c => c.id !== id));
    await supabase.from("crm_clients").delete().eq("id", id);
  }
  async function setAgentCode(agentId, code) {
    const existing = codes.find(c => c.agentId === agentId);
    if (existing) {
      setCodes(prev => prev.map(c => c.agentId === agentId ? { ...c, code } : c));
      await supabase.from("crm_agent_codes").update({ code }).eq("agent_id", agentId);
    } else {
      setCodes(prev => [...prev, { agentId, code }]);
      await supabase.from("crm_agent_codes").insert({ agent_id: agentId, code });
    }
  }
  async function addAgentEntry(nom, poste, localisation) {
    const newAgent = { id: uid(), nom, poste, localisation };
    setAgents(prev => [...prev, newAgent]);
    await supabase.from("agents").insert(newAgent);
  }
  async function removeAgentEntry(id) {
    setAgents(prev => prev.filter(a => a.id !== id));
    await supabase.from("crm_agent_codes").delete().eq("agent_id", id);
    await supabase.from("agents").delete().eq("id", id);
  }
  async function setDonneeRH(agentId, mois, updates) {
    const existing = donneesRH.find(d => d.agentId === agentId && d.mois === mois);
    const merged = { agentId, mois, pourcentageTempsTravaille: existing ? existing.pourcentageTempsTravaille : 0, primeAssiduite: existing ? existing.primeAssiduite : 0, primeVersee: existing ? existing.primeVersee : false, ...updates };
    setDonneesRH(prev => existing ? prev.map(d => (d.agentId === agentId && d.mois === mois) ? merged : d) : [...prev, merged]);
    await supabase.from("crm_donnees_rh_mensuelles").upsert({ agent_id: agentId, mois, pourcentage_temps_travaille: merged.pourcentageTempsTravaille, prime_assiduite: merged.primeAssiduite, prime_versee: merged.primeVersee });
  }
  async function handleAdminSetup(pw) {
    await supabase.from("app_passwords").insert({ app_name: APP_NAME_ADMIN, password: pw });
    setAdminStoredPw(pw);
    setAdminSetupMode(false);
    setAdminConnecte(true);
  }
  async function handleChangeAdminPassword(oldPw, newPw) {
    if (oldPw !== adminStoredPw) return false;
    await supabase.from("app_passwords").update({ password: newPw }).eq("app_name", APP_NAME_ADMIN);
    setAdminStoredPw(newPw);
    return true;
  }
  function handleAgentLogin(code) {
    const match = codes.find(c => c.code === code);
    if (!match) return false;
    const agent = agents.find(a => a.id === match.agentId);
    if (!agent) return false;
    setAgentConnecte({ id: agent.id, nom: agent.nom });
    return true;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: FONT_BODY }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: TEXT_MUTED }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: SIGNAL, boxShadow: `0 0 12px ${SIGNAL}`, animation: "askgPulse 1.6s ease-in-out infinite" }} />
          <span style={{ fontSize: 13 }}>Connexion à la ligne…</span>
        </div>
      </div>
    );
  }

  if (!mode && !splashDone) return <SplashKate onCommencer={() => setSplashDone(true)} />;
  if (!mode) return <ChoixModeScreen onChoose={setMode} />;
  if (mode === "agent" && !agentConnecte) return <AgentLoginScreen onLogin={handleAgentLogin} onBack={() => setMode(null)} />;
  if (mode === "admin" && !adminConnecte) {
    if (adminSetupMode) return <AdminSetupScreen onSubmit={handleAdminSetup} onBack={() => setMode(null)} />;
    return <AdminLoginScreen storedPw={adminStoredPw} onLogin={() => setAdminConnecte(true)} onBack={() => setMode(null)} />;
  }
  if (mode === "agent" && agentConnecte) {
    return <AgentApp agent={agentConnecte} clients={clients.filter(c => c.agentId === agentConnecte.id)} allClients={clients} agents={agents} donneesRH={donneesRH} addClient={addClient} updateClient={updateClient} onLogout={() => setAgentConnecte(null)} />;
  }
  if (mode === "admin" && adminConnecte) {
    return <AdminApp agents={agents} clients={clients} codes={codes} donneesRH={donneesRH} setDonneeRH={setDonneeRH} setAgentCode={setAgentCode} addAgentEntry={addAgentEntry} removeAgentEntry={removeAgentEntry} updateClient={updateClient} removeClient={removeClient} onChangePassword={handleChangeAdminPassword} onLogout={() => setAdminConnecte(false)} />;
  }
  return null;
}

// ============================================================
// ÉCRAN DE CHOIX INITIAL
// ============================================================
// ============================================================
// ÉCRAN "BIENVENUE DANS KATE" — diapositive d'ouverture, une fois par session
// ============================================================
function SplashKate({ onCommencer }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: FONT_BODY, position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <BgGlow />
      <CallFloorIllustration />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: 20 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 4, color: TEXT_MUTED, fontWeight: 600, opacity: 0, animation: "askgRevealUp 1s ease forwards", animationDelay: ".6s" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: SIGNAL, display: "inline-block", marginRight: 8, boxShadow: `0 0 12px ${SIGNAL}`, animation: "askgPulse 1.6s ease-in-out infinite", verticalAlign: "middle" }} />
          ASK GROUP SARL
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500, color: "#C7CCDA", marginTop: 14, letterSpacing: 1, opacity: 0, animation: "askgRevealUp 1.2s cubic-bezier(.16,1,.3,1) forwards", animationDelay: "1.8s" }}>
          Bienvenue dans
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: "clamp(64px, 12vw, 110px)", fontWeight: 800, marginTop: 6, letterSpacing: 2,
          background: "linear-gradient(120deg, #2D6CDF, #4FB8D9 40%, #7A5FC7 80%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          filter: "drop-shadow(0 0 40px rgba(45,108,223,.35))",
          opacity: 0, animation: "askgKateIn 2.6s cubic-bezier(.16,1,.3,1) forwards", animationDelay: "3.2s",
        }}>
          Kate
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT_MUTED, marginTop: 18, opacity: 0, animation: "askgRevealUp 1s ease forwards", animationDelay: "5.6s" }}>
          Ensemble on performe, ensemble on va plus loin.
        </div>
        <div style={{ marginTop: 42, opacity: 0, animation: "askgRevealUp 1.2s cubic-bezier(.16,1,.3,1) forwards", animationDelay: "6.6s" }}>
          <button
            onClick={(e) => { ripple(e); onCommencer(); }}
            style={{ position: "relative", overflow: "hidden", background: SIGNAL, color: "white", border: "none", padding: "16px 46px", borderRadius: 99, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, cursor: "pointer", boxShadow: "0 14px 38px rgba(45,108,223,.45)", transition: "transform .2s ease, box-shadow .2s ease" }}
          >Commencer</button>
        </div>
      </div>
    </div>
  );
}

function ChoixModeScreen({ onChoose }) {
  const [hover, setHover] = useState("agent");
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: FONT_BODY, position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="askg-page-frame" />
      <BgGlow />
      <Waveform pos="top" />
      <Waveform pos="bottom" />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 56, flexWrap: "wrap", padding: 20 }}>
        <AgentIllustration size={230} />
        <div style={{ background: "rgba(29,32,41,.92)", backdropFilter: "blur(20px)", border: `1px solid ${LINE}`, borderRadius: 20, padding: 40, width: 370, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.5)", animation: "askgCardIn .7s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: SIGNAL, boxShadow: `0 0 10px ${SIGNAL}`, animation: "askgPulse 1.6s ease-in-out infinite" }} />
            <div style={{ fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 600, fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
          </div>
          <h1 style={{ fontSize: 24, color: TEXT, margin: "8px 0 2px", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>CRM Kate</h1>
          <p style={{ fontSize: 12, color: TEXT_MUTED, margin: "0 0 26px" }}>Suivi des rendez-vous, en direct</p>
          <button
            className="askg-btn"
            onMouseEnter={() => setHover("agent")}
            onClick={(e) => { ripple(e); onChoose("agent"); }}
            style={{
              width: "100%", border: "none", padding: 15, borderRadius: 12, fontWeight: 600, fontSize: 14.5, marginBottom: 10, cursor: "pointer", fontFamily: FONT_DISPLAY, position: "relative", overflow: "hidden",
              background: hover === "agent" ? SIGNAL : "transparent",
              color: hover === "agent" ? "white" : "#C7CCDA",
              boxShadow: hover === "agent" ? "0 10px 28px rgba(45,108,223,.4)" : "none",
              transition: "background .25s ease, color .25s ease, box-shadow .25s ease",
            }}
          >Je suis un agent</button>
          <button
            className="askg-btn"
            onMouseEnter={() => setHover("admin")}
            onClick={(e) => { ripple(e); onChoose("admin"); }}
            style={{
              width: "100%", padding: 15, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT_DISPLAY, position: "relative", overflow: "hidden",
              background: hover === "admin" ? SIGNAL : "transparent",
              color: hover === "admin" ? "white" : "#C7CCDA",
              border: hover === "admin" ? "none" : `1px solid ${LINE}`,
              boxShadow: hover === "admin" ? "0 10px 28px rgba(45,108,223,.4)" : "none",
              transition: "background .25s ease, color .25s ease, box-shadow .25s ease, border-color .25s ease",
            }}
          >Accès Direction</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CONNEXION AGENT / ADMIN
// ============================================================
function AuthShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: FONT_BODY, position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="askg-page-frame" />
      <BgGlow opacity={.6} />
      {children}
    </div>
  );
}

function AgentLoginScreen({ onLogin, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit() { if (!onLogin(code)) setError("Code incorrect. Vérifie auprès de la Direction."); }
  return (
    <AuthShell>
      <div style={{ position: "relative", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 20, padding: 36, width: 360, boxShadow: "0 30px 80px rgba(0,0,0,.5)", animation: "askgCardIn .7s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 600, textAlign: "center", fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 19, textAlign: "center", color: TEXT, margin: "10px 0 22px", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>Connexion Agent</h1>
        <label style={darkLabelStyle}>Ton code personnel</label>
        <PasswordInput value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={e => e.key === "Enter" && submit()} style={{ ...darkInputStyle, textAlign: "center", fontSize: 26, letterSpacing: 10, fontFamily: FONT_MONO }} placeholder="••••" autoFocus centered />
        {error && <div style={{ color: "#F0888D", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button className="askg-btn" onClick={(e) => { ripple(e); submit(); }} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: 13, borderRadius: 10, fontWeight: 600, fontSize: 14, marginTop: 20, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Se connecter</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: TEXT_MUTED, border: "none", padding: 10, fontSize: 12, marginTop: 4, cursor: "pointer" }}>← Retour</button>
      </div>
    </AuthShell>
  );
}

function AdminSetupScreen({ onSubmit, onBack }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [error, setError] = useState("");
  function submit() {
    if (pw.length < 4) { setError("Le mot de passe doit faire au moins 4 caractères."); return; }
    if (pw !== pw2) { setError("Les deux mots de passe ne correspondent pas."); return; }
    onSubmit(pw);
  }
  return (
    <AuthShell>
      <div style={{ position: "relative", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 20, padding: 36, width: 380, boxShadow: "0 30px 80px rgba(0,0,0,.5)", animation: "askgCardIn .7s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 600, textAlign: "center", fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 19, textAlign: "center", color: TEXT, margin: "10px 0 4px", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>Première utilisation Direction</h1>
        <p style={{ fontSize: 12.5, color: TEXT_MUTED, textAlign: "center", marginBottom: 22 }}>Crée le mot de passe Admin. Tu seras le seul à le connaître.</p>
        <label style={darkLabelStyle}>Nouveau mot de passe</label>
        <PasswordInput value={pw} onChange={e => setPw(e.target.value)} style={darkInputStyle} placeholder="Au moins 4 caractères" />
        <label style={{ ...darkLabelStyle, marginTop: 12 }}>Confirme le mot de passe</label>
        <PasswordInput value={pw2} onChange={e => setPw2(e.target.value)} style={darkInputStyle} />
        {error && <div style={{ color: "#F0888D", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button className="askg-btn" onClick={(e) => { ripple(e); submit(); }} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: 13, borderRadius: 10, fontWeight: 600, fontSize: 14, marginTop: 20, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Créer mon accès Admin</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: TEXT_MUTED, border: "none", padding: 10, fontSize: 12, marginTop: 4, cursor: "pointer" }}>← Retour</button>
      </div>
    </AuthShell>
  );
}

function AdminLoginScreen({ storedPw, onLogin, onBack }) {
  const [pw, setPw] = useState(""); const [error, setError] = useState("");
  function submit() { if (pw === storedPw) onLogin(); else setError("Mot de passe incorrect."); }
  return (
    <AuthShell>
      <div style={{ position: "relative", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 20, padding: 36, width: 360, boxShadow: "0 30px 80px rgba(0,0,0,.5)", animation: "askgCardIn .7s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TEXT_MUTED, fontWeight: 600, textAlign: "center", fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 19, textAlign: "center", color: TEXT, margin: "10px 0 22px", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>Accès Direction</h1>
        <label style={darkLabelStyle}>Mot de passe</label>
        <PasswordInput value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={darkInputStyle} autoFocus />
        {error && <div style={{ color: "#F0888D", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button className="askg-btn" onClick={(e) => { ripple(e); submit(); }} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: 13, borderRadius: 10, fontWeight: 600, fontSize: 14, marginTop: 20, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Connexion</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: TEXT_MUTED, border: "none", padding: 10, fontSize: 12, marginTop: 4, cursor: "pointer" }}>← Retour</button>
      </div>
    </AuthShell>
  );
}

// ============================================================
// APPLICATION AGENT
// ============================================================
function AgentApp({ agent, clients, allClients, agents, donneesRH, addClient, updateClient, onLogout }) {
  const emptyForm = { nomClient: "", telephone: "", adresse: "", mail: "", produit: "", dateRdv: todayISO(), notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [configData, setConfigData] = useState({ ...EMPTY_CONFIG });
  const [editingId, setEditingId] = useState(null);
  const [vue, setVue] = useState("perso");
  const [modalOpen, setModalOpen] = useState(null); // null | "coord" | "config"
  const [viewConfigId, setViewConfigId] = useState(null);

  function submit() {
    if (!form.nomClient || !form.telephone) return;
    const payload = { ...form, configurationMaison: JSON.stringify(configData) };
    if (editingId) { updateClient(editingId, payload); setEditingId(null); }
    else { addClient(payload); }
    setForm(emptyForm);
    setConfigData({ ...EMPTY_CONFIG });
  }
  function startEdit(c) {
    setForm({ nomClient: c.nomClient, telephone: c.telephone, adresse: c.adresse || "", mail: c.mail || "", produit: c.produit || "", dateRdv: c.dateRdv || todayISO(), notes: c.notes || "" });
    setConfigData(parseConfig(c.configurationMaison));
    setEditingId(c.id);
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); setConfigData({ ...EMPTY_CONFIG }); }
  const counts = {};
  STATUTS.forEach(s => { counts[s.key] = clients.filter(c => c.statut === s.key).length; });
  const coordRemplis = countFilled(form, FIELDS_COORDONNEES.map(f => f.key));
  const configRemplis = countFilled(configData, Object.values(FIELDS_CONFIG).flat().map(f => f.key));
  const configTotal = Object.values(FIELDS_CONFIG).flat().length;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT_BODY }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ background: SURFACE, color: TEXT, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: SIGNAL, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>{agent.nom.charAt(0)}</div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: TEXT_MUTED, fontWeight: 600, fontFamily: FONT_MONO }}>ASK GROUP — CRM</div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: FONT_DISPLAY }}>{agent.nom}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", display: "flex", background: "rgba(255,255,255,.05)", borderRadius: 99, padding: 4, border: `1px solid ${LINE}`, width: 330 }}>
            <div style={{ position: "absolute", top: 4, bottom: 4, left: `calc(${["perso", "collectif", "primes"].indexOf(vue)} * ((100% - 8px) / 3) + 4px)`, width: "calc((100% - 8px) / 3)", background: SIGNAL, borderRadius: 99, transition: "left .35s cubic-bezier(.16,1,.3,1)", boxShadow: "0 4px 14px rgba(45,108,223,.45)" }} />
            {[["perso", "Mon espace"], ["collectif", "Espace collectif"], ["primes", "💰 Mes primes"]].map(([k, l]) => (
              <button key={k} onClick={(e) => { ripple(e); setVue(k); }} style={{ position: "relative", zIndex: 1, flex: 1, border: "none", background: "transparent", borderRadius: 99, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: vue === k ? "white" : TEXT_MUTED, transition: "color .25s ease", overflow: "hidden" }}>{l}</button>
            ))}
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,.06)", color: TEXT, border: `1px solid ${LINE}`, padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Déconnexion</button>
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        <div key={vue} style={{ animation: "askgPageIn 3.5s cubic-bezier(.16,1,.3,1)" }}>
        {vue === "collectif" ? (
          <EspaceCollectif agents={agents} allClients={allClients} agentActuelId={agent.id} donneesRH={donneesRH} />
        ) : vue === "primes" ? (
          <MesPrimesPage agent={agent} allClients={allClients} donneesRH={donneesRH} />
        ) : (
        <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
          {STATUTS.map((s, i) => (
            <div key={s.key} className="askg-kpi" style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, borderTop: `3px solid ${s.color}`, transition: "all .2s ease", animation: "askgFadeUp .5s ease forwards", animationDelay: (i * .06) + "s", opacity: 0 }}>
              <div style={{ fontSize: 9.5, color: TEXT_MUTED, textTransform: "uppercase", fontWeight: 700, letterSpacing: .3 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 5, color: s.color, fontFamily: FONT_DISPLAY }}>{counts[s.key]}</div>
            </div>
          ))}
        </div>

        <Panel title={editingId ? "Modifier le client" : "Nouveau client / rendez-vous"} accent>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <button className="askg-btn" onClick={(e) => { ripple(e); setModalOpen("coord"); }} style={{ ...ghostBtnStyle, borderColor: coordRemplis > 0 ? SIGNAL : LINE, color: coordRemplis > 0 ? "#9CC0FF" : TEXT_MUTED, padding: "12px 16px" }}>📇 Coordonnées client {coordRemplis > 0 && <span style={{ fontFamily: FONT_MONO, marginLeft: 4 }}>({coordRemplis}/{FIELDS_COORDONNEES.length})</span>}</button>
            <button className="askg-btn" onClick={(e) => { ripple(e); setModalOpen("config"); }} style={{ ...ghostBtnStyle, borderColor: configRemplis > 0 ? SIGNAL : LINE, color: configRemplis > 0 ? "#9CC0FF" : TEXT_MUTED, padding: "12px 16px" }}>🏠 Configuration de la maison {configRemplis > 0 && <span style={{ fontFamily: FONT_MONO, marginLeft: 4 }}>({configRemplis}/{configTotal})</span>}</button>
            <Field label="Produit / Service"><input type="text" value={form.produit} onChange={e => setForm({ ...form, produit: e.target.value })} style={{ ...inputStyle, width: 170 }} /></Field>
            <Field label="Date RDV"><input type="date" value={form.dateRdv} onChange={e => setForm({ ...form, dateRdv: e.target.value })} style={inputStyle} /></Field>
            <Field label="Commentaires / Notes"><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, width: 180 }} /></Field>
            <button className="askg-btn" onClick={(e) => { ripple(e); submit(); }} style={primaryBtnStyle}>{editingId ? "Enregistrer" : "+ Ajouter"}</button>
            {editingId && <button className="askg-btn" onClick={(e) => { ripple(e); cancelEdit(); }} style={ghostBtnStyle}>Annuler</button>}
          </div>
          {!form.nomClient && <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>💡 Remplis au moins le nom et le téléphone dans "Coordonnées client" avant d'ajouter.</div>}
        </Panel>

        {modalOpen === "coord" && <CoordonneesModal values={form} onChange={(k, v) => setForm({ ...form, [k]: v })} onClose={() => setModalOpen(null)} />}
        {modalOpen === "config" && <ConfigMaisonModal values={configData} onChange={(k, v) => setConfigData({ ...configData, [k]: v })} onClose={() => setModalOpen(null)} />}

        <Panel title={`Mes clients (${clients.length})`}>
          {clients.length === 0 ? <EmptyState text="Aucun client enregistré pour l'instant." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clients.map((c, i) => (
                <div key={c.id} className="askg-client-card" style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, background: SURFACE, transition: "all .2s ease", animation: "askgFadeUp .4s ease forwards", animationDelay: Math.min(i * .05, .3) + "s", opacity: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: TEXT, fontFamily: FONT_DISPLAY }}>{c.nomClient}</div>
                      <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONT_MONO }}>{c.telephone}</span>
                        {c.produit && <span>· {c.produit}</span>}
                        {c.dateRdv && <span>· {new Date(c.dateRdv).toLocaleDateString("fr-FR")}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: statutInfo(c.statut).bg, color: statutInfo(c.statut).color }}>{statutInfo(c.statut).label}</span>
                      <button className="askg-btn" onClick={(e) => { ripple(e); startEdit(c); }} style={editBtnStyle}>Modifier</button>
                    </div>
                  </div>
                  <SignalChain current={c.statut} />
                  {c.mail && <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>{c.mail}</div>}
                  {countFilled(parseConfig(c.configurationMaison), Object.values(FIELDS_CONFIG).flat().map(f => f.key)) > 0 && (
                    <button className="askg-btn" onClick={(e) => { ripple(e); setViewConfigId(c.id); }} style={{ ...editBtnStyle, marginTop: 10, background: "rgba(122,95,199,.12)", color: "#B7A3E8" }}>🏠 Voir la configuration maison</button>
                  )}
                  {c.notes && <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 6, fontStyle: "italic" }}>{c.notes}</div>}
                  {c.statut === "rappeler" && (
                    <div style={{ fontSize: 12, color: "#4FB8D9", marginTop: 10, background: "rgba(79,184,217,.1)", border: "1px solid rgba(79,184,217,.25)", borderRadius: 8, padding: "6px 10px" }}>
                      📞 {c.rappelDate ? `À rappeler le ${new Date(c.rappelDate).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "À rappeler — date non encore fixée par la Direction"}
                      {c.rappelCommentaire && <div style={{ marginTop: 4 }}>{c.rappelCommentaire}</div>}
                    </div>
                  )}
                  {c.statut === "annule" && (
                    <div style={{ fontSize: 12, color: "#E0656B", marginTop: 10, background: "rgba(196,61,70,.1)", border: "1px solid rgba(196,61,70,.25)", borderRadius: 8, padding: "6px 10px" }}>
                      {c.raisonAnnulation ? `Raison (Direction) : ${c.raisonAnnulation}` : "Annulé — raison non encore précisée par la Direction"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <EnergyIcons />
        {viewConfigId && (() => {
          const c = clients.find(x => x.id === viewConfigId);
          return c ? <ConfigMaisonModal values={parseConfig(c.configurationMaison)} onChange={() => {}} onClose={() => setViewConfigId(null)} readOnly /> : null;
        })()}
        </>
        )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ESPACE COLLECTIF — vue lecture seule des statistiques de toute l'équipe
// ============================================================
function EspaceCollectif({ agents, allClients, agentActuelId, donneesRH }) {
  const moisActuel = todayISO().slice(0, 7);
  const moisLabel = new Date(moisActuel + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const classement = agents
    .map(a => {
      const clientsAgent = allClients.filter(c => c.agentId === a.id);
      const prime = calcPrimePerformance(a, clientsAgent, donneesRH, moisActuel);
      const report = calcTotalAvecReport(a, clientsAgent, donneesRH, moisActuel);
      return { agent: a, clientsAgent, prime, report };
    })
    .sort((x, y) => y.report.total - x.report.total);
  const medailles = ["🥇", "🥈", "🥉"];

  return (
    <>
      <PageHeader title="Espace collectif" subtitle={`Suivi en direct de toute l'équipe et classement des primes de ${moisLabel} — lecture seule`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {classement.map(({ agent: a, clientsAgent, prime, report }, ai) => {
          const isMe = a.id === agentActuelId;
          return (
            <div key={a.id} className="askg-kpi" style={{ background: SURFACE, border: `1px solid ${isMe ? SIGNAL : LINE}`, borderRadius: 14, padding: 16, animation: "askgFadeUp .4s ease forwards", animationDelay: (ai * .08) + "s", opacity: 0, position: "relative" }}>
              {ai < 3 && <div style={{ position: "absolute", top: -10, right: 14, fontSize: 22, animation: "askgFloaty 3s ease-in-out infinite", animationDelay: (ai * .3) + "s" }}>{medailles[ai]}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: isMe ? SIGNAL : "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12 }}>{a.nom.charAt(0)}</div>
                <div style={{ fontWeight: 600, fontFamily: FONT_DISPLAY, color: TEXT, fontSize: 14 }}>{a.nom}{isMe && <span style={{ color: SIGNAL, fontSize: 10, fontWeight: 700 }}> · toi</span>}</div>
              </div>

              <div style={{ background: "rgba(45,108,223,.1)", border: `1px solid ${SIGNAL}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "#9CC0FF", textTransform: "uppercase", fontWeight: 700 }}>Primes de {moisLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white", fontFamily: FONT_DISPLAY, marginTop: 2 }}>{fmtUSD(report.total)}</div>
                <div style={{ fontSize: 10.5, color: "#9CC0FF", marginTop: 2 }}>
                  Basique {prime.primeBasiqueEligible ? "✓" : "✗"} · {fmtUSD(prime.totalSurprimesMois)} surprimes
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {STATUTS.map(s => (
                  <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: TEXT_MUTED }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: s.color, fontFamily: FONT_DISPLAY }}>{clientsAgent.filter(c => c.statut === s.key).length}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
                  <span style={{ color: TEXT, fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 700, color: TEXT, fontFamily: FONT_DISPLAY }}>{clientsAgent.length}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// MES PRIMES — prime de performance (calculée ici) + prime d'assiduité (miroir du RH)
// ============================================================
function ConditionRow({ ok, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "6px 0" }}>
      <span style={{ width: 18, height: 18, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, background: ok ? "rgba(15,169,143,.18)" : "rgba(196,61,70,.18)", color: ok ? "#0FA98F" : "#E0656B" }}>{ok ? "✓" : "✗"}</span>
      <span style={{ color: TEXT }}>{label}</span>
    </div>
  );
}
function MesPrimesPage({ agent, allClients, donneesRH }) {
  const [mois, setMois] = useState(todayISO().slice(0, 7));
  const clientsAgent = allClients.filter(c => c.agentId === agent.id);
  const p = calcPrimePerformance(agent, clientsAgent, donneesRH, mois);
  const report = calcTotalAvecReport(agent, clientsAgent, donneesRH, mois);
  const [y, m] = mois.split("-").map(Number);
  const moisLabel = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <PageHeader title="💰 Mes primes" subtitle={`Prime de performance et prime d'assiduité — ${moisLabel}`} />
        <input type="month" value={mois} onChange={e => setMois(e.target.value)} style={{ background: SURFACE, border: `1px solid ${LINE}`, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: TEXT }} />
      </div>

      <div style={{ background: p.primeVersee ? "rgba(15,169,143,.12)" : "rgba(196,130,30,.12)", border: `1px solid ${p.primeVersee ? "#0FA98F" : "#C4821E"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: p.primeVersee ? "#0FA98F" : "#C4821E", fontWeight: 600, animation: "askgFadeUp .4s ease" }}>
        {p.primeVersee ? `✓ Vous avez reçu l'intégralité de vos primes de ${moisLabel}` : `⏳ Vous n'avez pas encore reçu vos primes de ${moisLabel}`}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: SURFACE, border: `1px solid ${p.primeBasiqueEligible ? "#0FA98F" : LINE}`, borderRadius: 14, padding: 16, borderTop: `3px solid ${p.primeBasiqueEligible ? "#0FA98F" : "#3A3E4C"}`, animation: "askgFadeUp .45s ease forwards", animationDelay: ".05s", opacity: 0 }}>
          <div style={{ fontSize: 9.5, color: TEXT_MUTED, textTransform: "uppercase", fontWeight: 700 }}>Prime basique</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5, color: p.primeBasiqueEligible ? "#0FA98F" : TEXT_MUTED, fontFamily: FONT_DISPLAY }}>{fmtUSD(p.primeBasique)}</div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{p.primeBasiqueEligible ? "🎉 Éligible ce mois-ci" : "Non éligible ce mois-ci"}</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16, borderTop: "3px solid #4FB8D9", animation: "askgFadeUp .45s ease forwards", animationDelay: ".1s", opacity: 0 }}>
          <div style={{ fontSize: 9.5, color: TEXT_MUTED, textTransform: "uppercase", fontWeight: 700 }}>Surprimes de {moisLabel}</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5, color: "#4FB8D9", fontFamily: FONT_DISPLAY }}>{fmtUSD(p.totalSurprimesMois)}</div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{p.nbDocuments} documents · {p.nbInstalles} installations ce mois</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16, borderTop: "3px solid #7A5FC7", animation: "askgFadeUp .45s ease forwards", animationDelay: ".15s", opacity: 0 }}>
          <div style={{ fontSize: 9.5, color: TEXT_MUTED, textTransform: "uppercase", fontWeight: 700 }}>Prime d'assiduité (RH)</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 5, color: "#7A5FC7", fontFamily: FONT_DISPLAY }}>{fmtUSD(p.primeAssiduite)}</div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>Saisie par la Direction pour ce mois</div>
        </div>
        <div style={{ background: "rgba(45,108,223,.1)", border: `1px solid ${SIGNAL}`, borderRadius: 14, padding: 16, animation: "askgFadeUp .45s ease forwards", animationDelay: ".2s", opacity: 0 }}>
          <div style={{ fontSize: 9.5, color: "#9CC0FF", textTransform: "uppercase", fontWeight: 700 }}>Total {report.moisEnRetard.length > 0 ? "dû" : "ce mois"}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 5, color: "white", fontFamily: FONT_DISPLAY }}>{fmtUSD(report.total)}</div>
          <div style={{ fontSize: 11, color: "#9CC0FF", marginTop: 2 }}>{report.moisEnRetard.length > 0 ? `Inclut l'arriéré de ${report.moisEnRetard.length} mois non versé(s)` : "Basique + surprimes + assiduité"}</div>
        </div>
      </div>

      <Panel title="Conditions de la prime basique (25 $)" accent>
        <ConditionRow ok={p.cond1} label={`Au moins 18 rendez-vous ce mois — actuellement ${p.nbRdv}`} />
        <ConditionRow ok={p.cond2} label={`Au moins 80% de qualité validée — actuellement ${p.juges > 0 ? Math.round(p.tauxQualite) + "%" : "aucun rendez-vous jugé"} (${p.valides}/${p.juges} validés)`} />
        <ConditionRow ok={p.cond3} label={`Au moins 90% du temps de travail attendu — actuellement ${Math.round(p.ratioTravail)}%`} />
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>Les 3 conditions doivent être remplies en même temps pour toucher les 25 $ ce mois-ci.</div>
      </Panel>

      <Panel title={`Surprimes de ${moisLabel} — détail`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: TEXT }}>📄 Documents reçus ({p.nbDocuments} client{p.nbDocuments > 1 ? "s" : ""} × 5 $)</span>
            <b style={{ color: "#4FB8D9" }}>{fmtUSD(p.surprimeDocuments)}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: TEXT }}>🏠 Installations ({p.nbInstalles} client{p.nbInstalles > 1 ? "s" : ""} × 50 $)</span>
            <b style={{ color: "#0FA98F" }}>{fmtUSD(p.surprimeInstallation)}</b>
          </div>
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 12 }}>Une surprime compte pour le mois où le statut a été changé — pas le mois du rendez-vous.</div>
      </Panel>
    </>
  );
}
function fmtUSD(n) { return (n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " $"; }

// ============================================================
// APPLICATION ADMIN
// ============================================================
function AdminApp({ agents, clients, codes, donneesRH, setDonneeRH, setAgentCode, addAgentEntry, removeAgentEntry, updateClient, removeClient, onChangePassword, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const navItems = [["dashboard", "Tableau de bord"], ["clients", "Tous les clients"], ["agents", "Gestion des agents"], ["donneesrh", "Données RH"], ["codes", "Codes agents"], ["parametres", "Paramètres"]];
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT_BODY }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ background: SURFACE, color: TEXT, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: SIGNAL, boxShadow: `0 0 10px ${SIGNAL}`, animation: "askgPulse 1.6s ease-in-out infinite" }} />
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: TEXT_MUTED, fontWeight: 600, fontFamily: FONT_MONO }}>ASK GROUP</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: FONT_DISPLAY }}>CRM — Direction</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {navItems.map(([k, l]) => (
            <button key={k} className="askg-btn" onClick={(e) => { ripple(e); setPage(k); }} style={{ border: "none", borderRadius: 99, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: page === k ? SIGNAL : "rgba(255,255,255,.05)", color: page === k ? "white" : TEXT_MUTED, transition: "background .2s ease, color .2s ease", position: "relative", overflow: "hidden" }}>{l}</button>
          ))}
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,.06)", color: TEXT, border: `1px solid ${LINE}`, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Déconnexion</button>
        </div>
      </div>
      <div style={{ padding: "24px 28px", maxWidth: 1300, margin: "0 auto", overflowX: "auto" }}>
        <div key={page} style={{ animation: "askgPageIn 3.5s cubic-bezier(.16,1,.3,1)" }}>
          {page === "dashboard" && <DashboardPage agents={agents} clients={clients} donneesRH={donneesRH} />}
          {page === "clients" && <TousLesClientsPage agents={agents} clients={clients} updateClient={updateClient} removeClient={removeClient} />}
          {page === "agents" && <GestionAgentsPage agents={agents} clients={clients} addAgentEntry={addAgentEntry} removeAgentEntry={removeAgentEntry} />}
          {page === "donneesrh" && <DonneesRHPage agents={agents} donneesRH={donneesRH} setDonneeRH={setDonneeRH} />}
          {page === "codes" && <CodesAgentsPage agents={agents} codes={codes} setAgentCode={setAgentCode} />}
          {page === "parametres" && <ParametresPage onChangePassword={onChangePassword} />}
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ agents, clients, donneesRH }) {
  const counts = {};
  STATUTS.forEach(s => { counts[s.key] = clients.filter(c => c.statut === s.key).length; });
  function nomAgent(id) { const a = agents.find(x => x.id === id); return a ? a.nom : "?"; }
  const moisActuel = todayISO().slice(0, 7);
  const parAgent = agents.map(a => {
    const clientsAgent = clients.filter(c => c.agentId === a.id);
    const prime = calcPrimePerformance(a, clientsAgent, donneesRH, moisActuel);
    const report = calcTotalAvecReport(a, clientsAgent, donneesRH, moisActuel);
    return { id: a.id, nom: a.nom, total: clientsAgent.length, installes: clientsAgent.filter(c => c.statut === "installe").length, prime, report };
  });

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de tous les agents, en direct" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}>
        {STATUTS.map((s, i) => (
          <div key={s.key} className="askg-kpi" style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${s.color}`, transition: "all .2s ease", animation: "askgFadeUp .5s ease forwards", animationDelay: (i * .06) + "s", opacity: 0 }}>
            <div style={{ fontSize: 9.5, color: TEXT_MUTED, textTransform: "uppercase", fontWeight: 700, letterSpacing: .3 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 5, color: s.color, fontFamily: FONT_DISPLAY }}>{counts[s.key]}</div>
          </div>
        ))}
      </div>
      <Panel title={`Performance par agent — primes de ${new Date(moisActuel + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>Agent</Th><Th>Total clients</Th><Th>Installés</Th><Th>Prime basique</Th><Th>Surprimes du mois</Th><Th>Total dû ce mois</Th></tr></thead>
          <tbody>{parAgent.map((a, ai) => (
            <tr key={a.id} className="askg-tbl-row" style={{ transition: "background .2s ease", animation: "askgRowIn .4s ease forwards", animationDelay: (ai * .07) + "s", opacity: 0 }}>
              <Td><b>{a.nom}</b></Td>
              <Td>{a.total}</Td>
              <Td style={{ color: statutInfo("installe").color }}><b>{a.installes}</b></Td>
              <Td style={{ color: a.prime.primeBasiqueEligible ? "#0FA98F" : TEXT_MUTED }}><b>{fmtUSD(a.prime.primeBasique)}</b>{!a.prime.primeBasiqueEligible && <span style={{ fontSize: 10 }}> (non éligible)</span>}</Td>
              <Td style={{ color: "#4FB8D9" }}><b>{fmtUSD(a.prime.totalSurprimesMois)}</b></Td>
              <Td style={{ color: "#9CC0FF" }}><b>{fmtUSD(a.report.total)}</b>{a.report.moisEnRetard.length > 0 && <span style={{ fontSize: 10, color: "#C4821E" }}> (+{a.report.moisEnRetard.length} mois en retard)</span>}</Td>
            </tr>
          ))}</tbody>
        </table>
      </Panel>
      <Panel title="Derniers clients ajoutés">
        {clients.length === 0 ? <EmptyState text="Aucun client enregistré." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Client</Th><Th>Agent</Th><Th>Statut</Th></tr></thead>
            <tbody>{clients.slice(0, 8).map((c, i) => (<tr key={c.id} className="askg-tbl-row" style={{ transition: "background .2s ease", animation: "askgRowIn .4s ease forwards", animationDelay: (i * .05) + "s", opacity: 0 }}><Td><b>{c.nomClient}</b></Td><Td>{nomAgent(c.agentId)}</Td><Td><StatutBadge value={c.statut} /></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <svg width="60" height="60" viewBox="0 0 60 60" style={{ opacity: .45, animation: "askgFloaty 4s ease-in-out infinite" }}><rect x="8" y="16" width="30" height="22" rx="4" fill="none" stroke={SIGNAL} strokeWidth="3" /><circle cx="23" cy="27" r="8" fill="none" stroke={SIGNAL} strokeWidth="2.4" /><path d="M23 21 Q27 27 23 33 Q19 27 23 21" fill={SIGNAL} /><line x1="42" y1="27" x2="54" y2="27" stroke={SIGNAL} strokeWidth="3" strokeLinecap="round" /></svg>
      </div>
    </>
  );
}

function TousLesClientsPage({ agents, clients, updateClient, removeClient }) {
  const [filtreAgent, setFiltreAgent] = useState("tous");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [viewCoordId, setViewCoordId] = useState(null);
  const [viewConfigId, setViewConfigId] = useState(null);
  function nomAgent(id) { const a = agents.find(x => x.id === id); return a ? a.nom : "?"; }
  const filtres = clients.filter(c => (filtreAgent === "tous" || c.agentId === filtreAgent) && (filtreStatut === "tous" || c.statut === filtreStatut));
  const clientCoord = clients.find(x => x.id === viewCoordId);
  const clientConfig = clients.find(x => x.id === viewConfigId);

  return (
    <>
      <PageHeader title="Tous les clients" subtitle="Vue complète, tous agents confondus — modifiable" />
      <Panel title="Filtres">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Field label="Agent">
            <select value={filtreAgent} onChange={e => setFiltreAgent(e.target.value)} style={inputStyle}>
              <option value="tous">Tous les agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </Field>
          <Field label="Statut">
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={inputStyle}>
              <option value="tous">Tous les statuts</option>
              {STATUTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
        </div>
      </Panel>
      <Panel title={`Clients (${filtres.length})`}>
        {filtres.length === 0 ? <EmptyState text="Aucun client ne correspond à ces filtres." /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="askg-tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><Th>Agent</Th><Th>Client</Th><Th>Téléphone</Th><Th>Produit</Th><Th>Coordonnées</Th><Th>Config. maison</Th><Th>Date RDV</Th><Th>Statut</Th><Th>Qualité</Th><Th>Détails (rappel / raison)</Th><Th>Notes</Th><Th></Th></tr></thead>
              <tbody>
                {filtres.map((c, i) => (
                  <tr key={c.id} className="askg-tbl-row" style={{ transition: "background .2s ease", animation: "askgRowIn .4s ease forwards", animationDelay: Math.min(i * .04, .3) + "s", opacity: 0 }}>
                    <Td>{nomAgent(c.agentId)}</Td>
                    <Td><b>{c.nomClient}</b></Td>
                    <Td style={{ fontFamily: FONT_MONO }}>{c.telephone}</Td>
                    <Td>{c.produit}</Td>
                    <Td><button className="askg-btn" onClick={(e) => { ripple(e); setViewCoordId(c.id); }} style={{ ...editBtnStyle, background: "rgba(45,108,223,.12)", color: "#9CC0FF" }}>📇 Voir</button></Td>
                    <Td><button className="askg-btn" onClick={(e) => { ripple(e); setViewConfigId(c.id); }} style={{ ...editBtnStyle, background: "rgba(122,95,199,.12)", color: "#B7A3E8" }}>🏠 Voir</button></Td>
                    <Td>{c.dateRdv ? new Date(c.dateRdv).toLocaleDateString("fr-FR") : "—"}</Td>
                    <Td>
                      <select value={c.statut} onChange={e => updateClient(c.id, { statut: e.target.value })} style={{ ...inputStyle, background: statutInfo(c.statut).bg, color: statutInfo(c.statut).color, fontWeight: 700 }}>
                        {STATUTS.map(s => <option key={s.key} value={s.key} style={{ background: SURFACE, color: TEXT }}>{s.label}</option>)}
                      </select>
                    </Td>
                    <Td>
                      <select value={c.qualite || ""} onChange={e => updateClient(c.id, { qualite: e.target.value })} style={{ ...inputStyle, width: 130, fontWeight: 700, background: c.qualite === "valide" ? "rgba(15,169,143,.14)" : c.qualite === "non_valide" ? "rgba(196,61,70,.14)" : "rgba(255,255,255,.06)", color: c.qualite === "valide" ? "#0FA98F" : c.qualite === "non_valide" ? "#E0656B" : TEXT_MUTED }}>
                        <option value="" style={{ background: SURFACE, color: TEXT }}>Non jugé</option>
                        <option value="valide" style={{ background: SURFACE, color: TEXT }}>✓ Qualité OK</option>
                        <option value="non_valide" style={{ background: SURFACE, color: TEXT }}>✗ Non qualité</option>
                      </select>
                    </Td>
                    <Td>
                      {c.statut === "rappeler" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input type="datetime-local" defaultValue={c.rappelDate ? c.rappelDate.slice(0, 16) : ""} onBlur={e => updateClient(c.id, { rappelDate: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ ...inputStyle, width: 160 }} />
                          <input type="text" defaultValue={c.rappelCommentaire || ""} placeholder="Commentaire du rappel..." onBlur={e => updateClient(c.id, { rappelCommentaire: e.target.value })} style={{ ...inputStyle, width: 160, background: "white", color: "#1B1D24", fontWeight: 400 }} />
                        </div>
                      )}
                      {c.statut === "annule" && (
                        <input type="text" defaultValue={c.raisonAnnulation || ""} placeholder="Pourquoi perdu..." onBlur={e => updateClient(c.id, { raisonAnnulation: e.target.value })} style={{ ...inputStyle, width: 160, background: "white", color: "#1B1D24", fontWeight: 400 }} />
                      )}
                      {c.statut !== "rappeler" && c.statut !== "annule" && <span style={{ color: TEXT_MUTED }}>—</span>}
                    </Td>
                    <Td style={{ maxWidth: 160 }}>{c.notes}</Td>
                    <Td><button className="askg-btn" onClick={(e) => { ripple(e); removeClient(c.id); }} style={delBtnStyle}>Suppr.</button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {clientCoord && <AdminCoordonneesModal client={clientCoord} onClose={() => setViewCoordId(null)} onSave={(draft) => updateClient(clientCoord.id, draft)} />}
      {clientConfig && <AdminConfigMaisonModal client={clientConfig} onClose={() => setViewConfigId(null)} onSave={(draft) => updateClient(clientConfig.id, { configurationMaison: JSON.stringify(draft) })} />}
    </>
  );
}

// ============================================================
// GESTION DES AGENTS — ajout / suppression, directement depuis le CRM
// (même liste d'agents que le logiciel RH — partagée)
// ============================================================
// ============================================================
// DONNÉES RH DU MOIS — saisie manuelle (indépendante du logiciel RH)
// % temps travaillé (lu sur le Récapitulatif du RH) + montant de la prime d'assiduité
// ============================================================
function DonneesRHPage({ agents, donneesRH, setDonneeRH }) {
  const [mois, setMois] = useState(todayISO().slice(0, 7));
  const [edits, setEdits] = useState({});
  function donneeActuelle(agentId) {
    return donneesRH.find(x => x.agentId === agentId && x.mois === mois) || { pourcentageTempsTravaille: 0, primeAssiduite: 0, primeVersee: false };
  }
  function valeurAffichee(agentId, champ) {
    const key = agentId + "_" + champ;
    return key in edits ? edits[key] : donneeActuelle(agentId)[champ];
  }
  function onEdit(agentId, champ, val) {
    setEdits(prev => ({ ...prev, [agentId + "_" + champ]: val }));
  }
  function enregistrer(agentId) {
    const pct = parseFloat(valeurAffichee(agentId, "pourcentageTempsTravaille")) || 0;
    const prime = parseFloat(valeurAffichee(agentId, "primeAssiduite")) || 0;
    setDonneeRH(agentId, mois, { pourcentageTempsTravaille: pct, primeAssiduite: prime });
    setEdits(prev => { const c = { ...prev }; delete c[agentId + "_pourcentageTempsTravaille"]; delete c[agentId + "_primeAssiduite"]; return c; });
  }
  function toggleVersee(agentId, val) {
    setDonneeRH(agentId, mois, { primeVersee: val });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <PageHeader title="Données RH du mois" subtitle="Saisie manuelle — lis les valeurs sur le Récapitulatif du Suivi RH et reporte-les ici" />
        <input type="month" value={mois} onChange={e => setMois(e.target.value)} style={{ background: SURFACE, border: `1px solid ${LINE}`, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: TEXT }} />
      </div>
      <Panel title="Par agent" accent>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>Agent</Th><Th>% temps travaillé (RH)</Th><Th>Prime d'assiduité (RH)</Th><Th></Th><Th>Statut des primes</Th></tr></thead>
          <tbody>
            {agents.map(a => {
              const versee = donneeActuelle(a.id).primeVersee;
              return (
              <tr key={a.id} className="askg-tbl-row" style={{ transition: "background .2s ease" }}>
                <Td><b>{a.nom}</b></Td>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" step="0.1" value={valeurAffichee(a.id, "pourcentageTempsTravaille")} onChange={e => onEdit(a.id, "pourcentageTempsTravaille", e.target.value)} style={{ ...inputStyle, width: 80 }} />
                    <span style={{ color: TEXT_MUTED, fontSize: 11 }}>%</span>
                  </div>
                </Td>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" step="0.5" value={valeurAffichee(a.id, "primeAssiduite")} onChange={e => onEdit(a.id, "primeAssiduite", e.target.value)} style={{ ...inputStyle, width: 80 }} />
                    <span style={{ color: TEXT_MUTED, fontSize: 11 }}>$</span>
                  </div>
                </Td>
                <Td><button className="askg-btn" onClick={(e) => { ripple(e); enregistrer(a.id); }} style={primaryBtnStyle}>Enregistrer</button></Td>
                <Td>
                  <button className="askg-btn" onClick={(e) => { ripple(e); toggleVersee(a.id, !versee); }} style={{ ...editBtnStyle, background: versee ? "rgba(15,169,143,.14)" : "rgba(196,130,30,.14)", color: versee ? "#0FA98F" : "#C4821E" }}>
                    {versee ? "✓ Prime versée" : "⏳ Prime non versée"}
                  </button>
                </Td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 14 }}>ℹ️ Tant qu'un mois n'est pas marqué "Prime versée", son montant reste dû et s'ajoute automatiquement au mois suivant côté agent.</div>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>ℹ️ Ces deux valeurs se lisent dans le Suivi RH → Récapitulatif → colonnes "% temps travaillé" et "Prime assiduité", pour le même mois.</div>
    </>
  );
}

function GestionAgentsPage({ agents, clients, addAgentEntry, removeAgentEntry }) {
  const [nom, setNom] = useState("");
  const [poste, setPoste] = useState("Agent de téléprospection");
  const [localisation, setLocalisation] = useState("RDC");

  function submit() {
    if (!nom.trim()) return;
    addAgentEntry(nom.trim(), poste, localisation);
    setNom("");
  }
  function retirer(a) {
    const nbClients = clients.filter(c => c.agentId === a.id).length;
    const msg = nbClients > 0
      ? `${a.nom} a ${nbClients} client(s) enregistré(s) dans le CRM. Le supprimer ici le retirera aussi du logiciel RH. Continuer ?`
      : `Retirer ${a.nom} ? Cela le retirera aussi du logiciel RH.`;
    if (window.confirm(msg)) removeAgentEntry(a.id);
  }

  return (
    <>
      <PageHeader title="Gestion des agents" subtitle="Liste partagée avec le Suivi RH — toute modification ici s'applique aussi là-bas" />
      <Panel title="Ajouter un agent" accent>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Nom complet"><input type="text" value={nom} onChange={e => setNom(e.target.value)} style={{ ...inputStyle, width: 200 }} /></Field>
          <Field label="Poste">
            <select value={poste} onChange={e => setPoste(e.target.value)} style={{ ...inputStyle, width: 200 }}>
              {["Agent de téléprospection", "Gérant local délégué", "Responsable production", "Technicien informatique", "Comptable/RH", "Avocat", "Autre"].map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Localisation">
            <select value={localisation} onChange={e => setLocalisation(e.target.value)} style={inputStyle}>
              <option value="RDC">🇨🇩 Kinshasa — RDC</option>
              <option value="TN">🇹🇳 Tunisie</option>
            </select>
          </Field>
          <button className="askg-btn" onClick={(e) => { ripple(e); submit(); }} style={primaryBtnStyle}>+ Ajouter</button>
        </div>
      </Panel>
      <Panel title={`Tous les agents (${agents.length})`}>
        {agents.length === 0 ? <EmptyState text="Aucun agent enregistré." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Nom</Th><Th>Poste</Th><Th>Localisation</Th><Th></Th></tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className="askg-tbl-row" style={{ transition: "background .2s ease" }}>
                  <Td><b>{a.nom}</b></Td>
                  <Td>{a.poste}</Td>
                  <Td><span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: a.localisation === "TN" ? "rgba(122,95,199,.14)" : "rgba(15,169,143,.14)", color: a.localisation === "TN" ? "#B7A3E8" : "#0FA98F" }}>{a.localisation === "TN" ? "🇹🇳 Tunisie" : "🇨🇩 RDC"}</span></Td>
                  <Td><button className="askg-btn" onClick={(e) => { ripple(e); retirer(a); }} style={delBtnStyle}>Retirer</button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function CodesAgentsPage({ agents, codes, setAgentCode }) {
  const [edits, setEdits] = useState({});
  function codeActuel(agentId) { const c = codes.find(x => x.agentId === agentId); return c ? c.code : ""; }
  function submit(agentId) {
    const val = (edits[agentId] || "").trim();
    if (val.length !== 4 || isNaN(val)) { window.alert("Le code doit être composé de 4 chiffres exactement."); return; }
    setAgentCode(agentId, val);
    setEdits(prev => ({ ...prev, [agentId]: "" }));
  }
  return (
    <>
      <PageHeader title="Codes d'accès agents" subtitle="Chaque agent utilise ce code (4 chiffres) pour se connecter et voir ses propres clients" />
      <Panel title="Tous les agents">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>Agent</Th><Th>Code actuel</Th><Th>Nouveau code</Th><Th></Th></tr></thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} className="askg-tbl-row" style={{ transition: "background .2s ease" }}>
                <Td><b>{a.nom}</b></Td>
                <Td>{codeActuel(a.id) ? <b style={{ letterSpacing: 3, fontFamily: FONT_MONO }}>{codeActuel(a.id)}</b> : <span style={{ color: TEXT_MUTED }}>Aucun code défini</span>}</Td>
                <Td><input type="text" maxLength={4} value={edits[a.id] || ""} onChange={e => setEdits(prev => ({ ...prev, [a.id]: e.target.value.replace(/\D/g, "") }))} placeholder="0000" style={{ ...inputStyle, width: 70, textAlign: "center", letterSpacing: 3, fontFamily: FONT_MONO }} /></Td>
                <Td><button className="askg-btn" onClick={(e) => { ripple(e); submit(a.id); }} style={editBtnStyle}>{codeActuel(a.id) ? "Modifier" : "Créer"}</button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>Communique le code à chaque agent individuellement, en privé.</div>
    </>
  );
}

function ParametresPage({ onChangePassword }) {
  const [oldPw, setOldPw] = useState(""); const [newPw, setNewPw] = useState(""); const [newPw2, setNewPw2] = useState(""); const [msg, setMsg] = useState("");
  async function submit() {
    if (newPw.length < 4) { setMsg("Le nouveau mot de passe doit faire au moins 4 caractères."); return; }
    if (newPw !== newPw2) { setMsg("Les deux nouveaux mots de passe ne correspondent pas."); return; }
    const ok = await onChangePassword(oldPw, newPw);
    if (ok) { setMsg("✓ Mot de passe modifié avec succès."); setOldPw(""); setNewPw(""); setNewPw2(""); }
    else setMsg("L'ancien mot de passe est incorrect.");
  }
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Sécurité de l'accès Direction" />
      <Panel title="Changer le mot de passe Admin">
        <div style={{ maxWidth: 320 }}>
          <label style={labelStyle}>Mot de passe actuel</label>
          <PasswordInput value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          <label style={labelStyle}>Nouveau mot de passe</label>
          <PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          <label style={labelStyle}>Confirme le nouveau mot de passe</label>
          <PasswordInput value={newPw2} onChange={e => setNewPw2(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? statutInfo("installe").color : "#E0656B", marginBottom: 10 }}>{msg}</div>}
          <button className="askg-btn" onClick={(e) => { ripple(e); submit(); }} style={primaryBtnStyle}>Modifier le mot de passe</button>
        </div>
      </Panel>
    </>
  );
}

// ============================================================
// COMPOSANTS UTILITAIRES
// ============================================================
function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 23, margin: 0, fontWeight: 600, color: TEXT, fontFamily: FONT_DISPLAY }}>{title}</h1>
      <div style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}
function Panel({ title, children, accent }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, marginBottom: 18, overflow: "hidden" }}>
      <div style={{ padding: "15px 20px", borderBottom: `1px solid ${LINE}`, borderLeft: accent ? `3px solid ${SIGNAL}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 13.5, margin: 0, fontWeight: 600, color: TEXT, fontFamily: FONT_DISPLAY }}>{title}</h2>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
function Field({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }
function Th({ children }) { return <th className="sortable" style={{ textAlign: "left", padding: "8px 10px", background: "rgba(255,255,255,.02)", color: TEXT_MUTED, fontWeight: 700, fontSize: 9.5, textTransform: "uppercase", letterSpacing: .3, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", cursor: "default", transition: "color .2s ease" }}>{children}</th>; }
function Td({ children, style }) { return <td style={{ padding: "9px 10px", borderBottom: `1px solid ${LINE}`, color: TEXT, ...style }}>{children}</td>; }
function StatutBadge({ value }) {
  const s = statutInfo(value);
  return <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg }}>{s.label}</span>;
}
function EmptyState({ text }) { return <div style={{ textAlign: "center", padding: "30px 10px", color: TEXT_MUTED, fontSize: 13 }}>{text}</div>; }

const inputStyle = { border: `1px solid ${LINE}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, background: "rgba(45,108,223,.1)", color: "#9CC0FF", fontWeight: 600, fontFamily: FONT_BODY };
const darkInputStyle = { width: "100%", border: `1px solid ${LINE}`, borderRadius: 9, padding: "11px 13px", fontSize: 14, marginTop: 4, boxSizing: "border-box", background: "#12141A", color: TEXT };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: TEXT_MUTED, marginBottom: 5 };
const darkLabelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, marginBottom: 5 };
const delBtnStyle = { background: statutInfo("annule").bg, color: statutInfo("annule").color, border: "none", padding: "5px 10px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
const editBtnStyle = { background: "rgba(45,108,223,.12)", color: "#9CC0FF", border: "none", padding: "5px 10px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
const primaryBtnStyle = { background: SIGNAL, color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12.5, fontFamily: FONT_DISPLAY };
const ghostBtnStyle = { background: "rgba(255,255,255,.06)", color: TEXT_MUTED, border: `1px solid ${LINE}`, padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12.5 };
