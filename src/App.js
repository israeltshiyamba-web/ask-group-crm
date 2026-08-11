import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// ASK GROUP SARL — CRM DE SUIVI DES RENDEZ-VOUS CLIENTS
// Connecté à la même base de données partagée que le RH/Compta
// Agents : accès par code personnel (4 chiffres), voient leurs
// propres clients uniquement. Admin : accès complet.
// ============================================================

const SUPABASE_URL = "https://sfuuzluaysxrdcqtvuto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdXV6bHVheXN4cmRjcXR2dXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTU2OTEsImV4cCI6MjA5NzU5MTY5MX0.2N6_dYs56LLV6hLLkxippeyxrMNSp9VlBUt_GUdEdcM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NAVY = "#0A1B3D";
const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2E2A8";
const APP_NAME_ADMIN = "crm_admin";

const STATUTS = [
  { key: "confirme", label: "Confirmé", color: "#1A4FB4", bg: "#EAF1FF" },
  { key: "documents", label: "Documents reçus", color: "#8a6500", bg: "#FFF3CD" },
  { key: "programme", label: "Programmé pour installation", color: "#7A3FA0", bg: "#F1E6FA" },
  { key: "installe", label: "Installé", color: "#1E7A4C", bg: "#E6F4EC" },
  { key: "annule", label: "Annulé / Perdu", color: "#B4322B", bg: "#FBE9E7" },
];
function statutInfo(key) { return STATUTS.find(s => s.key === key) || STATUTS[0]; }

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

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

  // Codes d'accès agents (admin uniquement)
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

  if (!loaded) return <div style={{ padding: 40, fontFamily: "sans-serif", color: NAVY }}>Chargement...</div>;

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
// ÉCRAN DE CHOIX INITIAL
// ============================================================
function ChoixModeScreen({ onChoose }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 40, width: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700 }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 22, color: NAVY, margin: "8px 0 28px" }}>CRM Clients</h1>
        <button onClick={() => onChoose("agent")} style={{ width: "100%", background: GOLD, color: NAVY, border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 15, marginBottom: 12, cursor: "pointer" }}>👤 Je suis un agent</button>
        <button onClick={() => onChoose("admin")} style={{ width: "100%", background: NAVY, color: "white", border: `1px solid ${GOLD}`, padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>🔒 Accès Direction</button>
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 36, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700, textAlign: "center" }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 20, textAlign: "center", color: NAVY, margin: "8px 0 20px" }}>👤 Connexion Agent</h1>
        <label style={labelStyle}>Ton code personnel (4 chiffres)</label>
        <input type="password" inputMode="numeric" maxLength={4} value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={{ ...loginInputStyle, textAlign: "center", fontSize: 24, letterSpacing: 8 }} placeholder="••••" autoFocus />
        {error && <div style={{ color: "#B4322B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", background: GOLD, color: NAVY, border: "none", padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer" }}>Se connecter</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: "#6B6B63", border: "none", padding: 10, fontSize: 12, marginTop: 6, cursor: "pointer" }}>← Retour</button>
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 36, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700, textAlign: "center" }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 20, textAlign: "center", color: NAVY, margin: "8px 0 4px" }}>CRM — Première utilisation Direction</h1>
        <p style={{ fontSize: 12.5, color: "#6B6B63", textAlign: "center", marginBottom: 24 }}>Crée le mot de passe Admin. Tu seras le seul à le connaître.</p>
        <label style={labelStyle}>Nouveau mot de passe</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={loginInputStyle} placeholder="Au moins 4 caractères" />
        <label style={{ ...labelStyle, marginTop: 12 }}>Confirme le mot de passe</label>
        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={loginInputStyle} />
        {error && <div style={{ color: "#B4322B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", background: GOLD, color: NAVY, border: "none", padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer" }}>Créer mon accès Admin</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: "#6B6B63", border: "none", padding: 10, fontSize: 12, marginTop: 6, cursor: "pointer" }}>← Retour</button>
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 36, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700, textAlign: "center" }}>ASK GROUP SARL</div>
        <h1 style={{ fontSize: 20, textAlign: "center", color: NAVY, margin: "8px 0 20px" }}>🔒 Accès Direction</h1>
        <label style={labelStyle}>Mot de passe</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={loginInputStyle} autoFocus />
        {error && <div style={{ color: "#B4322B", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", background: GOLD, color: NAVY, border: "none", padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 14, marginTop: 18, cursor: "pointer" }}>Déverrouiller</button>
        <button onClick={onBack} style={{ width: "100%", background: "none", color: "#6B6B63", border: "none", padding: 10, fontSize: 12, marginTop: 6, cursor: "pointer" }}>← Retour</button>
      </div>
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
    <div style={{ minHeight: "100vh", background: "#F6F5F1", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: NAVY, color: "white", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontWeight: 600 }}>ASK GROUP — CRM</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>👤 {agent.nom}</div>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,.1)", color: "white", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔒 Déconnexion</button>
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
          {STATUTS.map(s => (
            <div key={s.key} style={{ background: "white", border: "1px solid #E4E1D8", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#6B6B63", textTransform: "uppercase", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: s.color }}>{counts[s.key]}</div>
            </div>
          ))}
        </div>

        <Panel title={editingId ? "Modifier le client" : "+ Nouveau client / rendez-vous"}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Nom du client"><input type="text" value={form.nomClient} onChange={e => setForm({ ...form, nomClient: e.target.value })} style={{ ...inputStyle, width: 170 }} /></Field>
            <Field label="Téléphone"><input type="text" value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} style={{ ...inputStyle, width: 140 }} /></Field>
            <Field label="Adresse"><input type="text" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} style={{ ...inputStyle, width: 180 }} /></Field>
            <Field label="Produit / Service"><input type="text" value={form.produit} onChange={e => setForm({ ...form, produit: e.target.value })} style={{ ...inputStyle, width: 170 }} /></Field>
            <Field label="Date RDV"><input type="date" value={form.dateRdv} onChange={e => setForm({ ...form, dateRdv: e.target.value })} style={inputStyle} /></Field>
            <Field label="Notes"><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, width: 180 }} /></Field>
            <button onClick={submit} style={{ background: GOLD, color: NAVY, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{editingId ? "Enregistrer" : "+ Ajouter"}</button>
            {editingId && <button onClick={cancelEdit} style={{ background: "#F0F0EE", color: "#6B6B63", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Annuler</button>}
          </div>
        </Panel>

        <Panel title={`Mes clients (${clients.length})`}>
          {clients.length === 0 ? <EmptyState text="Aucun client enregistré pour l'instant." /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr><Th>Client</Th><Th>Téléphone</Th><Th>Produit</Th><Th>Date RDV</Th><Th>Statut</Th><Th>Notes</Th><Th></Th></tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id}>
                      <Td><b>{c.nomClient}</b></Td>
                      <Td>{c.telephone}</Td>
                      <Td>{c.produit}</Td>
                      <Td>{c.dateRdv ? new Date(c.dateRdv).toLocaleDateString("fr-FR") : "—"}</Td>
                      <Td>
                        <select value={c.statut} onChange={e => updateClient(c.id, { statut: e.target.value })} style={{ ...inputStyle, background: statutInfo(c.statut).bg, color: statutInfo(c.statut).color, fontWeight: 700 }}>
                          {STATUTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </Td>
                      <Td style={{ maxWidth: 160 }}>{c.notes}</Td>
                      <Td><button onClick={() => startEdit(c)} style={editBtnStyle}>Modifier</button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    <div className="askg-shell" style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif", background: "#F6F5F1" }}>
      <style>{RESPONSIVE_CSS}</style>
      <div className="askg-sidebar" style={{ width: 230, background: NAVY, color: "white", padding: "24px 0", flexShrink: 0 }}>
        <div className="askg-sidebar-header" style={{ padding: "0 24px 20px", borderBottom: "1px solid rgba(255,255,255,.1)", marginBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>ASK GROUP</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>CRM — Direction</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>🟢 Données partagées en ligne</div>
        </div>
        <div className="askg-sidebar-nav">
          {[["dashboard", "Tableau de bord"], ["clients", "Tous les clients"], ["codes", "Codes agents"], ["parametres", "Paramètres"]].map(([k, l]) => (
            <div key={k} onClick={() => setPage(k)} style={{ padding: "12px 24px", fontSize: 13, cursor: "pointer", borderLeft: page === k ? `3px solid ${GOLD}` : "3px solid transparent", background: page === k ? "rgba(212,175,55,.12)" : "transparent", color: page === k ? GOLD_LIGHT : "rgba(255,255,255,.65)", fontWeight: page === k ? 600 : 400 }}>{l}</div>
          ))}
        </div>
        <div className="askg-sidebar-footer" style={{ margin: "20px 24px 0" }}>
          <button onClick={onLogout} style={{ width: "100%", background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.8)", border: "none", padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔒 Verrouiller</button>
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
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Tableau de bord CRM</h1>
        <div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Vue d'ensemble de tous les agents</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}>
        {STATUTS.map(s => (
          <div key={s.key} style={{ background: "white", border: "1px solid #E4E1D8", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "#6B6B63", textTransform: "uppercase", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: s.color }}>{counts[s.key]}</div>
          </div>
        ))}
      </div>
      <Panel title="Performance par agent">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>Agent</Th><Th>Total clients</Th><Th>Installés</Th></tr></thead>
          <tbody>{parAgent.map(a => (<tr key={a.nom}><Td><b>{a.nom}</b></Td><Td>{a.total}</Td><Td style={{ color: "#1E7A4C" }}><b>{a.installes}</b></Td></tr>))}</tbody>
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
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Tous les clients</h1>
        <div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Vue complète, tous agents confondus — modifiable</div>
      </div>
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
                    <Td>{c.telephone}</Td>
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
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Codes d'accès agents</h1>
        <div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Chaque agent utilise ce code (4 chiffres) pour se connecter au CRM et voir ses propres clients</div>
      </div>
      <Panel title="Tous les agents">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>Agent</Th><Th>Code actuel</Th><Th>Nouveau code</Th><Th></Th></tr></thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <Td><b>{a.nom}</b></Td>
                <Td>{codeActuel(a.id) ? <b style={{ letterSpacing: 3 }}>{codeActuel(a.id)}</b> : <span style={{ color: "#999" }}>Aucun code défini</span>}</Td>
                <Td><input type="text" maxLength={4} value={edits[a.id] || ""} onChange={e => setEdits(prev => ({ ...prev, [a.id]: e.target.value.replace(/\D/g, "") }))} placeholder="0000" style={{ ...inputStyle, width: 70, textAlign: "center", letterSpacing: 3 }} /></Td>
                <Td><button onClick={() => submit(a.id)} style={editBtnStyle}>{codeActuel(a.id) ? "Modifier" : "Créer"}</button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div style={{ fontSize: 11, color: "#999" }}>ℹ️ Communique le code à chaque agent individuellement, en privé.</div>
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
      <div style={{ marginBottom: 22 }}><h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, color: NAVY }}>Paramètres</h1><div style={{ fontSize: 12.5, color: "#6B6B63", marginTop: 3 }}>Sécurité de l'accès Direction</div></div>
      <Panel title="Changer le mot de passe Admin">
        <div style={{ maxWidth: 320 }}>
          <label style={labelStyle}>Mot de passe actuel</label>
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: "white", color: "#1C1C1A" }} />
          <label style={labelStyle}>Nouveau mot de passe</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 10, background: "white", color: "#1C1C1A" }} />
          <label style={labelStyle}>Confirme le nouveau mot de passe</label>
          <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 14, background: "white", color: "#1C1C1A" }} />
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "#1E7A4C" : "#B4322B", marginBottom: 10 }}>{msg}</div>}
          <button onClick={submit} style={{ background: NAVY, color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Modifier le mot de passe</button>
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
function Panel({ title, children }) {
  return (<div style={{ background: "white", border: "1px solid #E4E1D8", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid #E4E1D8" }}><h2 style={{ fontSize: 14.5, margin: 0, fontWeight: 700, color: NAVY }}>{title}</h2></div><div style={{ padding: 18 }}>{children}</div></div>);
}
function Field({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div>; }
function Th({ children }) { return <th style={{ textAlign: "left", padding: "8px 10px", background: "#FAFAF7", color: "#6B6B63", fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #E4E1D8", whiteSpace: "nowrap" }}>{children}</th>; }
function Td({ children, style }) { return <td style={{ padding: "8px 10px", borderBottom: "1px solid #E4E1D8", ...style }}>{children}</td>; }
function StatutBadge({ value }) {
  const s = statutInfo(value);
  return <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>;
}
function EmptyState({ text }) { return <div style={{ textAlign: "center", padding: "30px 10px", color: "#999", fontSize: 13 }}>{text}</div>; }

const inputStyle = { border: "1px solid #E4E1D8", borderRadius: 5, padding: "7px 9px", fontSize: 12, background: "#EAF1FF", color: "#1A4FB4", fontWeight: 600 };
const loginInputStyle = { width: "100%", border: "1px solid #E4E1D8", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#6B6B63", marginBottom: 4 };
const delBtnStyle = { background: "#FBE9E7", color: "#B4322B", border: "none", padding: "4px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
const editBtnStyle = { background: "#EAF1FF", color: "#1A4FB4", border: "none", padding: "4px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer" };
