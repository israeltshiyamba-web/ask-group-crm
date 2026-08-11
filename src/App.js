import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// ASK GROUP SARL — CRM DE SUIVI DES RENDEZ-VOUS CLIENTS
// Connecté à la même base de données partagée que le RH/Compta
// Agents : accès par code personnel (4 chiffres), voient leurs
// propres clients uniquement. Admin : accès complet.
//
// DIRECTION ARTISTIQUE — « console de suivi d'appels »
// Fond graphite + signal color par étape du pipeline, typo
// technique (Space Grotesk / Inter / IBM Plex Mono pour les
// téléphones), pipeline visualisé comme une ligne d'appel.
// ============================================================

const SUPABASE_URL = "https://sfuuzluaysxrdcqtvuto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdXV6bHVheXN4cmRjcXR2dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTU2OTEsImV4cCI6MjA5NzU5MTY5MX0.2N6_dYs56LLV6hLLkxippeyxrMNSp9VlBUt_GUdEdcM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Tokens de design ────────────────────────────────────────
const INK = "#14161C";       // fond console (sidebar, écrans de connexion)
const SURFACE = "#1D2029";   // surfaces sur fond sombre
const LINE = "#2A2E3A";      // séparateurs sur fond sombre
const PAPER = "#F5F6F8";     // fond du contenu (clair)
const CARD = "#FFFFFF";
const BORDER = "#E2E5EA";
const INK_SOFT = "#5A6072";
const TEXT = "#1B1D24";

const SIGNAL = "#FF5A36";    // signal principal (CTA, "live")
const APP_NAME_ADMIN = "crm_admin";

const STATUTS = [
  { key: "confirme", label: "Confirmé", color: "#3E7CB1", bg: "#E8F1F9" },
  { key: "documents", label: "Documents reçus", color: "#C4821E", bg: "#FBF0DE" },
  { key: "programme", label: "Programmé installation", color: "#7A5FC7", bg: "#EFEAFB" },
  { key: "installe", label: "Installé", color: "#0FA98F", bg: "#E2F7F3" },
  { key: "annule", label: "Annulé / Perdu", color: "#C43D46", bg: "#FBE7E8" },
];
function statutInfo(key) { return STATUTS.find(s => s.key === key) || STATUTS[0]; }
function statutIndex(key) { const i = STATUTS.findIndex(s => s.key === key); return i < 0 ? 0 : i; }

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Polices ──────────────────────────────────────────────────
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');`;
const FONT_DISPLAY = "'Space Grotesk', 'Inter', sans-serif";
const FONT_BODY = "'Inter', 'Segoe UI', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

export default function App() {
  const [mode, setMode] = useState(null); // null | "agent" | "admin"
  const [agents, setAgents] = useState([]);
  const [clients, setClients] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Session agent / admin
  const [agentConnecte, setAgentConnecte] = useState(null); // { id, nom }
  const [adminConnecte, setAdminConnecte] = useState(false);
  const [adminStoredPw, setAdminStoredPw] = useState(null);
  const [adminSetupMode, setAdminSetupMode] = useState(false);

  useEffect(() => {
    async function loadAll() {
      const [a, c, cd, pw] = await Promise.all([
        supabase.from("agents").select("*").order("created_at"),
        supabase.from("crm_clients").select("*").order("created_at", { ascending: false }),
        supabase.from("crm_agent_codes").select("*"),
        supabase.from("app_passwords").select("*").eq("app_name", APP_NAME_ADMIN).maybeSingle(),
      ]);
      if (a.data) setAgents(a.data);
      if (c.data) setClients(c.data.map(x => ({ ...x, agentId: x.agent_id, nomClient: x.nom_client, dateRdv: x.date_rdv })));
      if (cd.data) setCodes(cd.data.map(x => ({ ...x, agentId: x.agent_id })));
      if (pw.data) setAdminStoredPw(pw.data.password);
      else setAdminSetupMode(true);
      setLoaded(true);
    }
    loadAll();
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  }, []);

  async function addClient(form) {
    const newRow = { id: uid(), agentId: agentConnecte.id, nomClient: form.nomClient, telephone: form.telephone, adresse: form.adresse, produit: form.produit, dateRdv: form.dateRdv, statut: "confirme", notes: form.notes, created_at: new Date().toISOString() };
    setClients(prev => [newRow, ...prev]);
    await supabase.from("crm_clients").insert({ id: newRow.id, agent_id: newRow.agentId, nom_client: newRow.nomClient, telephone: newRow.telephone, adresse: newRow.adresse, produit: newRow.produit, date_rdv: newRow.dateRdv || null, statut: "confirme", notes: newRow.notes });
  }
  async function updateClient(id, updates) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const dbUpdates = {};
    if ("nomClient" in updates) dbUpdates.nom_client = updates.nomClient;
    if ("telephone" in updates) dbUpdates.telephone = updates.telephone;
    if ("adresse" in updates) dbUpdates.adresse = updates.adresse;
    if ("produit" in updates) dbUpdates.produit = updates.produit;
    if ("dateRdv" in updates) dbUpdates.date_rdv = updates.dateRdv || null;
    if ("statut" in updates) dbUpdates.statut = updates.statut;
    if ("notes" in updates) dbUpdates.notes = updates.notes;
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

  if (!loaded) return <ConsoleLoading />;

  if (!mode) return <ChoixModeScreen onChoose={setMode} />;

  if (mode === "agent" && !agentConnecte) return <AgentLoginScreen onLogin={handleAgentLogin} onBack={() => setMode(null)} />;

  if (mode === "admin" && !adminConnecte) {
    if (adminSetupMode) return <AdminSetupScreen onSubmit={handleAdminSetup} onBack={() => setMode(null)} />;
    return <AdminLoginScreen storedPw={adminStoredPw} onLogin={() => setAdminConnecte(true)} onBack={() => setMode(null)} />;
  }

  if (mode === "agent" && agentConnecte) {
    return (
      <AgentApp
        agent={agentConnecte}
        clients={clients.filter(c => c.agentId === agentConnecte.id)}
        addClient={addClient}
        updateClient={updateClient}
        onLogout={() => setAgentConnecte(null)}
      />
    );
  }

  if (mode === "admin" && adminConnecte) {
    return (
      <AdminApp
        agents={agents}
        clients={clients}
        codes={codes}
        setAgentCode={setAgentCode}
        updateClient={updateClient}
        removeClient={removeClient}
        onChangePassword={handleChangeAdminPassword}
        onLogout={() => setAdminConnecte(false)}
      />
    );
  }

  return null;
}

// ============================================================
// ÉCRAN DE CHARGEMENT
// ============================================================
function ConsoleLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: INK, fontFamily: FONT_BODY }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8890A6" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: SIGNAL, boxShadow: `0 0 12px ${SIGNAL}` }} />
        <span style={{ fontSize: 13 }}>Connexion à la ligne…</span>
      </div>
    </div>
  );
}

// ============================================================
// ÉCRAN DE CHOIX INITIAL
// ============================================================
function ChoixModeScreen({ onChoose }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: INK, fontFamily: FONT_BODY, position: "relative", overflow: "hidden" }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 50% 0%, rgba(255,90,54,.14), transparent 55%)` }} />
      <div style={{ position: "relative", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: 40, width: 380, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: SIGNAL, boxShadow: `0 0 10px ${SIGNAL}` }} />
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#8890A6", fontWeight: 600, fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        </div>
        <h1 style={{ fontSize: 24, color: "#F5F6F8", margin: "6px 0 2px", fontFamily: FONT_DISPLAY, fontWeight: 700 }}>Ligne Clients</h1>
        <p style={{ fontSize: 12, color: "#6B7284", margin: "0 0 28px" }}>Suivi des rendez-vous, en direct</p>
        <button onClick={() => onChoose("agent")} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14.5, marginBottom: 10, cursor: "pointer", fontFamily: FONT_DISPLAY, boxShadow: `0 8px 24px rgba(255,90,54,.35)` }}>Je suis un agent</button>
        <button onClick={() => onChoose("admin")} style={{ width: "100%", background: "transparent", color: "#C7CCDA", border: `1px solid ${LINE}`, padding: "14px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Accès Direction</button>
      </div>
    </div>
  );
}

// ============================================================
// CONNEXION AGENT (code personnel)
// ============================================================
function AgentLoginScreen({ onLogin, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit() {
    if (!onLogin(code)) setError("Code incorrect. Vérifie auprès de la Direction.");
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: INK, fontFamily: FONT_BODY }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: 36, width: 360, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#8890A6", fontWeight: 600, textAlign: "center", fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 19, textAlign: "center", color: "#F5F6F8", margin: "10px 0 22px", fontFamily: FONT_DISPLAY, fontWeight: 700 }}>Connexion Agent</h1>
        <label style={darkLabelStyle}>Ton code personnel</label>
        <input type="password" inputMode="numeric" maxLength={4} value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={{ ...darkInputStyle, textAlign: "center", fontSize: 26, letterSpacing: 10, fontFamily: FONT_MONO }} placeholder="••••" autoFocus />
        {error && <div style={{ color: "#F0888D", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, marginTop: 20, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Se connecter</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: "#6B7284", border: "none", padding: 10, fontSize: 12, marginTop: 4, cursor: "pointer" }}>← Retour</button>
      </div>
    </div>
  );
}

// ============================================================
// CONNEXION / CRÉATION ADMIN
// ============================================================
function AdminSetupScreen({ onSubmit, onBack }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [error, setError] = useState("");
  function submit() {
    if (pw.length < 4) { setError("Le mot de passe doit faire au moins 4 caractères."); return; }
    if (pw !== pw2) { setError("Les deux mots de passe ne correspondent pas."); return; }
    onSubmit(pw);
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: INK, fontFamily: FONT_BODY }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: 36, width: 380, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#8890A6", fontWeight: 600, textAlign: "center", fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 19, textAlign: "center", color: "#F5F6F8", margin: "10px 0 4px", fontFamily: FONT_DISPLAY, fontWeight: 700 }}>Première utilisation Direction</h1>
        <p style={{ fontSize: 12.5, color: "#6B7284", textAlign: "center", marginBottom: 22 }}>Crée le mot de passe Admin. Tu seras le seul à le connaître.</p>
        <label style={darkLabelStyle}>Nouveau mot de passe</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={darkInputStyle} placeholder="Au moins 4 caractères" />
        <label style={{ ...darkLabelStyle, marginTop: 12 }}>Confirme le mot de passe</label>
        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={darkInputStyle} />
        {error && <div style={{ color: "#F0888D", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, marginTop: 20, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Créer mon accès Admin</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: "#6B7284", border: "none", padding: 10, fontSize: 12, marginTop: 4, cursor: "pointer" }}>← Retour</button>
      </div>
    </div>
  );
}

function AdminLoginScreen({ storedPw, onLogin, onBack }) {
  const [pw, setPw] = useState(""); const [error, setError] = useState("");
  function submit() {
    if (pw === storedPw) onLogin();
    else setError("Mot de passe incorrect.");
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: INK, fontFamily: FONT_BODY }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: 36, width: 360, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#8890A6", fontWeight: 600, textAlign: "center", fontFamily: FONT_MONO }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 19, textAlign: "center", color: "#F5F6F8", margin: "10px 0 22px", fontFamily: FONT_DISPLAY, fontWeight: 700 }}>Accès Direction</h1>
        <label style={darkLabelStyle}>Mot de passe</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={darkInputStyle} autoFocus />
        {error && <div style={{ color: "#F0888D", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", background: SIGNAL, color: "white", border: "none", padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, marginTop: 20, cursor: "pointer", fontFamily: FONT_DISPLAY }}>Déverrouiller</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: "#6B7284", border: "none", padding: 10, fontSize: 12, marginTop: 4, cursor: "pointer" }}>← Retour</button>
      </div>
    </div>
  );
}

// ============================================================
// LIGNE DE SIGNAL — visualisation du pipeline (élément signature)
// ============================================================
function SignalChain({ current, compact }) {
  const idx = statutIndex(current);
  const isAnnule = current === "annule";
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {STATUTS.filter(s => s.key !== "annule").map((s, i) => {
        const active = !isAnnule && i <= idx;
        const isCurrent = !isAnnule && i === idx;
        return (
          <React.Fragment key={s.key}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <span style={{
                width: isCurrent ? 12 : 8, height: isCurrent ? 12 : 8, borderRadius: 99,
                background: active ? s.color : "#DADEE6",
                boxShadow: isCurrent ? `0 0 0 4px ${s.bg}` : "none",
                transition: "all .2s",
              }} />
              {!compact && <span style={{ fontSize: 9, color: active ? s.color : "#A6ABB8", fontWeight: 600, marginTop: 5, textAlign: "center", maxWidth: 58, lineHeight: 1.15 }}>{s.label}</span>}
            </div>
            {i < 3 && <div style={{ flex: 1, height: 2, background: active && i < idx ? s.color : "#DADEE6", margin: compact ? "0 3px" : "0 4px 16px" }} />}
          </React.Fragment>
        );
      })}
      {isAnnule && <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, color: statutInfo("annule").color, background: statutInfo("annule").bg, padding: "3px 8px", borderRadius: 6 }}>ANNULÉ</span>}
    </div>
  );
}

// ============================================================
// APPLICATION AGENT
// ============================================================
function AgentApp({ agent, clients, addClient, updateClient, onLogout }) {
  const emptyForm = { nomClient: "", telephone: "", adresse: "", produit: "", dateRdv: todayISO(), notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function submit() {
    if (!form.nomClient || !form.telephone) return;
    if (editingId) { updateClient(editingId, form); setEditingId(null); }
    else { addClient(form); }
    setForm(emptyForm);
  }
  function startEdit(c) {
    setForm({ nomClient: c.nomClient, telephone: c.telephone, adresse: c.adresse || "", produit: c.produit || "", dateRdv: c.dateRdv || todayISO(), notes: c.notes || "" });
    setEditingId(c.id);
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  const counts = {};
  STATUTS.forEach(s => { counts[s.key] = clients.filter(c => c.statut === s.key).length; });

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: FONT_BODY }}>
      <style>{FONT_IMPORT}{RESPONSIVE_CSS}</style>
      <div style={{ background: INK, color: "white", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: SIGNAL, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{agent.nom.charAt(0)}</div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#8890A6", fontWeight: 600, fontFamily: FONT_MONO }}>ASK GROUP — LIGNE CLIENTS</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>{agent.nom}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,.08)", color: "white", border: `1px solid ${LINE}`, padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Déconnexion</button>
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
          {STATUTS.map(s => (
            <div key={s.key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 9.5, color: INK_SOFT, textTransform: "uppercase", fontWeight: 700, letterSpacing: .3 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 5, color: s.color, fontFamily: FONT_DISPLAY }}>{counts[s.key]}</div>
            </div>
          ))}
        </div>

        <Panel title={editingId ? "Modifier le client" : "Nouveau client / rendez-vous"} accent>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Nom du client"><input type="text" value={form.nomClient} onChange={e => setForm({ ...form, nomClient: e.target.value })} style={{ ...inputStyle, width: 170 }} /></Field>
            <Field label="Téléphone"><input type="text" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} style={{ ...inputStyle, width: 140, fontFamily: FONT_MONO }} /></Field>
            <Field label="Adresse"><input type="text" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} style={{ ...inputStyle, width: 180 }} /></Field>
            <Field label="Produit / Service"><input type="text" value={form.produit} onChange={e => setForm({ ...form, produit: e.target.value })} style={{ ...inputStyle, width: 170 }} /></Field>
            <Field label="Date RDV"><input type="date" value={form.dateRdv} onChange={e => setForm({ ...form, dateRdv: e.target.value })} style={inputStyle} /></Field>
            <Field label="Notes"><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, width: 180 }} /></Field>
            <button onClick={submit} style={primaryBtnStyle}>{editingId ? "Enregistrer" : "+ Ajouter"}</button>
            {editingId && <button onClick={cancelEdit} style={ghostBtnStyle}>Annuler</button>}
          </div>
        </Panel>

        <Panel title={`Mes clients (${clients.length})`}>
          {clients.length === 0 ? <EmptyState text="Aucun client enregistré pour l'instant." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clients.map(c => (
                <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, background: CARD }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, fontFamily: FONT_DISPLAY }}>{c.nomClient}</div>
                      <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONT_MONO }}>{c.telephone}</span>
                        {c.produit && <span>· {c.produit}</span>}
                        {c.dateRdv && <span>· {new Date(c.dateRdv).toLocaleDateString("fr-FR")}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={c.statut} onChange={e => updateClient(c.id, { statut: e.target.value })} style={{ ...inputStyle, background: statutInfo(c.statut).bg, color: statutInfo(c.statut).color, fontWeight: 700, border: "none" }}>
                        {STATUTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <button onClick={() => startEdit(c)} style={editBtnStyle}>Modifier</button>
                    </div>
                  </div>
                  <SignalChain current={c.statut} />
                  {c.notes && <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 10, fontStyle: "italic" }}>{c.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ============================================================
// APPLICATION ADMIN
// ============================================================
function AdminApp({ agents, clients, codes, setAgentCode, updateClient, removeClient, onChangePassword, onLogout }) {
  const [page, setPage] = useState("dashboard");
  return (
    <div className="askg-shell" style={{ display: "flex", minHeight: "100vh", fontFamily: FONT_BODY, background: PAPER }}>
      <style>{FONT_IMPORT}{RESPONSIVE_CSS}</style>
      <div className="askg-sidebar" style={{ width: 236, background: INK, color: "white", padding: "24px 0", flexShrink: 0 }}>
        <div className="askg-sidebar-header" style={{ padding: "0 24px 20px", borderBottom: `1px solid ${LINE}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: SIGNAL, boxShadow: `0 0 10px ${SIGNAL}` }} />
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#8890A6", fontWeight: 600, fontFamily: FONT_MONO }}>ASK GROUP</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>CRM — Direction</div>
          </div>
        </div>
        <div className="askg-sidebar-nav">
          {[["dashboard", "Tableau de bord"], ["clients", "Tous les clients"], ["codes", "Codes agents"], ["parametres", "Paramètres"]].map(([k, l]) => (
            <div key={k} onClick={() => setPage(k)} style={{ padding: "12px 24px", fontSize: 13, cursor: "pointer", borderLeft: page === k ? `3px solid ${SIGNAL}` : "3px solid transparent", background: page === k ? "rgba(255,90,54,.1)" : "transparent", color: page === k ? "#FFB39F" : "#9096A6", fontWeight: page === k ? 700 : 500 }}>{l}</div>
          ))}
        </div>
        <div className="askg-sidebar-footer" style={{ margin: "20px 24px 0" }}>
          <button onClick={onLogout} style={{ width: "100%", background: "rgba(255,255,255,.06)", color: "#C7CCDA", border: `1px solid ${LINE}`, padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Verrouiller</button>
        </div>
      </div>
      <div className="askg-main" style={{ flex: 1, padding: "28px 36px", overflowX: "auto" }}>
        {page === "dashboard" && <DashboardPage agents={agents} clients={clients} />}
        {page === "clients" && <TousLesClientsPage agents={agents} clients={clients} updateClient={updateClient} removeClient={removeClient} />}
        {page === "codes" && <CodesAgentsPage agents={agents} codes={codes} setAgentCode={setAgentCode} />}
        {page === "parametres" && <ParametresPage onChangePassword={onChangePassword} />}
      </div>
    </div>
  );
}

function DashboardPage({ agents, clients }) {
  const counts = {};
  STATUTS.forEach(s => { counts[s.key] = clients.filter(c => c.statut === s.key).length; });
  function nomAgent(id) { const a = agents.find(x => x.id === id); return a ? a.nom : "?"; }
  const parAgent = agents.map(a => ({ nom: a.nom, total: clients.filter(c => c.agentId === a.id).length, installes: clients.filter(c => c.agentId === a.id && c.statut === "installe").length }));

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de tous les agents, en direct" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}>
        {STATUTS.map(s => (
          <div key={s.key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 9.5, color: INK_SOFT, textTransform: "uppercase", fontWeight: 700, letterSpacing: .3 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 5, color: s.color, fontFamily: FONT_DISPLAY }}>{counts[s.key]}</div>
          </div>
        ))}
      </div>
      <Panel title="Ligne de pipeline globale" accent>
        <SignalChain current={STATUTS[Math.min(3, Math.round((counts.confirme*0+counts.documents*1+counts.programme*2+counts.installe*3)/Math.max(1,(counts.confirme+counts.documents+counts.programme+counts.installe))))].key} />
        <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 14 }}>Position moyenne de l'ensemble des dossiers actifs dans le pipeline.</div>
      </Panel>
      <Panel title="Performance par agent">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>Agent</Th><Th>Total clients</Th><Th>Installés</Th></tr></thead>
          <tbody>{parAgent.map(a => (<tr key={a.nom}><Td><b>{a.nom}</b></Td><Td>{a.total}</Td><Td style={{ color: statutInfo("installe").color }}><b>{a.installes}</b></Td></tr>))}</tbody>
        </table>
      </Panel>
      <Panel title="Derniers clients ajoutés">
        {clients.length === 0 ? <EmptyState text="Aucun client enregistré." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><Th>Client</Th><Th>Agent</Th><Th>Statut</Th></tr></thead>
            <tbody>{clients.slice(0, 8).map(c => (<tr key={c.id}><Td><b>{c.nomClient}</b></Td><Td>{nomAgent(c.agentId)}</Td><Td><StatutBadge value={c.statut} /></Td></tr>))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function TousLesClientsPage({ agents, clients, updateClient, removeClient }) {
  const [filtreAgent, setFiltreAgent] = useState("tous");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  function nomAgent(id) { const a = agents.find(x => x.id === id); return a ? a.nom : "?"; }

  const filtres = clients.filter(c => (filtreAgent === "tous" || c.agentId === filtreAgent) && (filtreStatut === "tous" || c.statut === filtreStatut));

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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><Th>Client</Th><Th>Agent</Th><Th>Téléphone</Th><Th>Produit</Th><Th>Date RDV</Th><Th>Statut</Th><Th>Notes</Th><Th></Th></tr></thead>
              <tbody>
                {filtres.map(c => (
                  <tr key={c.id}>
                    <Td><b>{c.nomClient}</b></Td>
                    <Td>{nomAgent(c.agentId)}</Td>
                    <Td style={{ fontFamily: FONT_MONO }}>{c.telephone}</Td>
                    <Td>{c.produit}</Td>
                    <Td>{c.dateRdv ? new Date(c.dateRdv).toLocaleDateString("fr-FR") : "—"}</Td>
                    <Td>
                      <select value={c.statut} onChange={e => updateClient(c.id, { statut: e.target.value })} style={{ ...inputStyle, background: statutInfo(c.statut).bg, color: statutInfo(c.statut).color, fontWeight: 700 }}>
                        {STATUTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </Td>
                    <Td style={{ maxWidth: 160 }}>{c.notes}</Td>
                    <Td><button onClick={() => removeClient(c.id)} style={delBtnStyle}>Suppr.</button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <tr key={a.id}>
                <Td><b>{a.nom}</b></Td>
                <Td>{codeActuel(a.id) ? <b style={{ letterSpacing: 3, fontFamily: FONT_MONO }}>{codeActuel(a.id)}</b> : <span style={{ color: "#A6ABB8" }}>Aucun code défini</span>}</Td>
                <Td><input type="text" maxLength={4} value={edits[a.id] || ""} onChange={e => setEdits(prev => ({ ...prev, [a.id]: e.target.value.replace(/\D/g, "") }))} placeholder="0000" style={{ ...inputStyle, width: 70, textAlign: "center", letterSpacing: 3, fontFamily: FONT_MONO }} /></Td>
                <Td><button onClick={() => submit(a.id)} style={editBtnStyle}>{codeActuel(a.id) ? "Modifier" : "Créer"}</button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div style={{ fontSize: 11, color: INK_SOFT }}>Communique le code à chaque agent individuellement, en privé.</div>
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
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: "white", color: TEXT }} />
          <label style={labelStyle}>Nouveau mot de passe</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: "white", color: TEXT }} />
          <label style={labelStyle}>Confirme le nouveau mot de passe</label>
          <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 14, background: "white", color: TEXT }} />
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? statutInfo("installe").color : "#C43D46", marginBottom: 10 }}>{msg}</div>}
          <button onClick={submit} style={primaryBtnStyle}>Modifier le mot de passe</button>
        </div>
      </Panel>
    </>
  );
}

// ============================================================
// STYLE RESPONSIVE (mobile / iPhone)
// ============================================================
const RESPONSIVE_CSS = `
@media (max-width: 768px) {
  .askg-shell { flex-direction: column !important; }
  .askg-sidebar { width: 100% !important; padding: 12px 0 !important; }
  .askg-sidebar-header { padding: 0 16px 12px !important; margin-bottom: 8px !important; }
  .askg-sidebar-nav { display: flex !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; padding: 0 8px !important; }
  .askg-sidebar-nav > div { white-space: nowrap !important; padding: 8px 14px !important; border-left: none !important; border-bottom: 3px solid transparent !important; }
  .askg-sidebar-footer { margin: 8px 16px 0 !important; }
  .askg-main { padding: 14px !important; }
  table { font-size: 11px !important; }
  h1 { font-size: 18px !important; }
}
`;

// ============================================================
// COMPOSANTS UTILITAIRES
// ============================================================
function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 23, margin: 0, fontWeight: 700, color: TEXT, fontFamily: FONT_DISPLAY }}>{title}</h1>
      <div style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}
function Panel({ title, children, accent }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 18, overflow: "hidden" }}>
      <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, borderLeft: accent ? `3px solid ${SIGNAL}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 13.5, margin: 0, fontWeight: 700, color: TEXT, fontFamily: FONT_DISPLAY }}>{title}</h2>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
function Field({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }
function Th({ children }) { return <th style={{ textAlign: "left", padding: "8px 10px", background: "#FAFBFC", color: INK_SOFT, fontWeight: 700, fontSize: 9.5, textTransform: "uppercase", letterSpacing: .3, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{children}</th>; }
function Td({ children, style }) { return <td style={{ padding: "9px 10px", borderBottom: `1px solid ${BORDER}`, color: TEXT, ...style }}>{children}</td>; }
function StatutBadge({ value }) {
  const s = statutInfo(value);
  return <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg }}>{s.label}</span>;
}
function EmptyState({ text }) { return <div style={{ textAlign: "center", padding: "30px 10px", color: "#A6ABB8", fontSize: 13 }}>{text}</div>; }

const inputStyle = { border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, background: "#F0F3FF", color: "#2A4FA0", fontWeight: 600, fontFamily: FONT_BODY };
const darkInputStyle = { width: "100%", border: `1px solid ${LINE}`, borderRadius: 9, padding: "11px 13px", fontSize: 14, marginTop: 4, boxSizing: "border-box", background: "#12141A", color: "#F5F6F8" };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: INK_SOFT, marginBottom: 5 };
const darkLabelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#8890A6", marginBottom: 5 };
const delBtnStyle = { background: statutInfo("annule").bg, color: statutInfo("annule").color, border: "none", padding: "5px 10px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
const editBtnStyle = { background: "#F0F3FF", color: "#2A4FA0", border: "none", padding: "5px 10px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
const primaryBtnStyle = { background: SIGNAL, color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12.5, fontFamily: FONT_DISPLAY };
const ghostBtnStyle = { background: "#EEF0F4", color: INK_SOFT, border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12.5 };
