import React, { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";

// Branding
const PRIMARY_COLOR = "#E3051B";
const BG_COLOR = "#fafbfc";
const FONT = 'Inter, system-ui, sans-serif';
const LOGO_URL = "https://cms.ordermonkey.com/assets/images/logo/order-monkey/order-monkey-red-en-2.svg";

const ROLE_MAP = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
} as const;
const ROLE_ORDER = ["A", "R", "C", "I"] as const;

type RoleKey = keyof typeof ROLE_MAP;

type Person = string;
type Responsibility = string;

interface PersonRole {
  person: Person;
  role: RoleKey;
}
interface ResponsibilityRole {
  responsibility: Responsibility;
  role: RoleKey;
}

function transform(rows: any[][]): [
  Record<Person, ResponsibilityRole[]>,
  Record<Responsibility, PersonRole[]>,
  Person[],
  Responsibility[]
] {
  if (!rows.length) return [{}, {}, [], []];
  const header = rows[0];
  const persons: Person[] = header.slice(1).filter(Boolean);
  const personToRes: Record<Person, ResponsibilityRole[]> = {};
  persons.forEach((p) => {
    personToRes[p] = [];
  });
  const respToPerson: Record<Responsibility, PersonRole[]> = {};
  const responsibilities: Responsibility[] = [];
  rows.slice(1).forEach((row) => {
    const responsibility = row[0];
    if (!responsibility) return;
    responsibilities.push(responsibility);
    persons.forEach((person, idx) => {
      const rawRole = row[idx + 1];
      const role = typeof rawRole === "string" ? rawRole.trim() : rawRole;
      if (
        role &&
        typeof role === "string" &&
        role.toUpperCase() === "N"
      ) {
        // Treat 'N' as Not Applicable: do not assign a role
        return;
      }
      if (role && ROLE_MAP[role as RoleKey]) {
        personToRes[person].push({ responsibility, role });
        if (!respToPerson[responsibility]) respToPerson[responsibility] = [];
        respToPerson[responsibility].push({ person, role });
      }
    });
  });
  return [personToRes, respToPerson, persons, responsibilities];
}

// --- Modal for PIN entry ---
function PinModal({ open, onClose, onSubmit, error }: { open: boolean; onClose: () => void; onSubmit: (pin: string) => void; error?: string }) {
  const [pin, setPin] = React.useState("");
  React.useEffect(() => { if (!open) setPin(""); }, [open]);
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.18)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 32, minWidth: 320, boxShadow: "0 4px 32px #0002", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 18, color: PRIMARY_COLOR }}>Enter PIN to Save</div>
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder="Enter PIN (e.g., 2025)"
          style={{ fontSize: 18, padding: 10, borderRadius: 8, border: `2px solid ${PRIMARY_COLOR}33`, marginBottom: 16, width: "100%", textAlign: "center" }}
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") onSubmit(pin); }}
        />
        {error && <div style={{ color: "#b71c1c", fontWeight: 600, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => onSubmit(pin)}
            style={{ background: PRIMARY_COLOR, color: "#fff", border: "none", borderRadius: 8, padding: "8px 24px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >Save</button>
          <button
            onClick={onClose}
            style={{ background: "#eee", color: PRIMARY_COLOR, border: "none", borderRadius: 8, padding: "8px 24px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}

function getFullMatrix(matrix: any[][]) {
  if (!matrix || !matrix.length) return null;
  const header = matrix[0];
  return (
    <div style={{
      overflowX: "auto",
      background: "#fff",
      borderRadius: 16,
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      padding: 16,
      maxWidth: 1000,
      margin: "0 auto",
      width: "100%"
    }}>
      <table style={{ minWidth: 600, width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
          <tr>
            {header.map((cell, idx) => (
              <th key={cell + '-' + idx} style={{ border: "1px solid #ccc", padding: "8px 12px", background: PRIMARY_COLOR, color: "#fff", position: "sticky", top: 0, fontWeight: 700 }}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.slice(1).map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={cell + '-' + j + '-' + i} style={{
                  border: "1px solid #ccc",
                  padding: "8px 12px",
                  textAlign: "center",
                  background: cell === "A" ? PRIMARY_COLOR : cell === "R" ? "#ffebee" : cell === "C" ? "#e3f2fd" : cell === "I" ? "#e8f5e9" : undefined,
                  color: cell === "A" ? "#fff" : cell === "R" ? PRIMARY_COLOR : cell === "C" ? "#1976d2" : cell === "I" ? "#43a047" : undefined,
                  fontWeight: cell === "A" ? 700 : 500
                }}>
                  {ROLE_MAP[cell as RoleKey] || (cell === undefined || cell === null || String(cell).trim() === "" || String(cell).trim().toUpperCase() === "N" ? "Not Applicable" : cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RaciViewer() {
  const [matrix, setMatrix] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"dashboard" | "responsibility" | "person" | "matrix">("dashboard");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editedMatrix, setEditedMatrix] = useState<any[][] | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function loadMatrix() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(process.env.PUBLIC_URL + "/RACI.xlsx");
        if (!res.ok) throw new Error("File not found");
        const buffer = await res.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        setMatrix(data);
      } catch (e: any) {
        setError("Failed to load RACI matrix. Please check the file in the public folder.");
      }
      setLoading(false);
    }
    loadMatrix();
  }, []);

  // Load edits from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("raci-matrix-edits");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMatrix(parsed);
      } catch {}
    }
  }, []);

  // Clear any previous edits from localStorage on load
  useEffect(() => {
    localStorage.removeItem("raci-matrix-edits");
  }, []);

  const [personToResponsibilities, responsibilityToPeople, persons, responsibilities] = useMemo(
    () => transform(matrix),
    [matrix]
  );

  // Responsive font
  useEffect(() => {
    document.body.style.fontFamily = FONT;
  }, []);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: PRIMARY_COLOR, fontFamily: FONT }}>Loading RACI Matrix...</div>;
  }
  if (error) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#b71c1c", fontFamily: FONT }}>{error}</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: BG_COLOR, fontFamily: FONT, padding: 0 }}>
      {/* Header with logo */}
      <header style={{
        width: "100%",
        background: "#fff",
        borderBottom: `3px solid ${PRIMARY_COLOR}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 32px 12px 32px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={LOGO_URL} alt="Order Monkey Logo" style={{ height: 40, marginRight: 12 }} />
          <span style={{ fontSize: 28, fontWeight: 800, color: PRIMARY_COLOR, letterSpacing: 1 }}>RACI Matrix Viewer</span>
        </div>
        <nav aria-label="Main navigation">
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setMode("dashboard")}
              aria-current={mode === "dashboard"}
              style={{
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 16,
                background: mode === "dashboard" ? PRIMARY_COLOR : "#f0f0f0",
                color: mode === "dashboard" ? "#fff" : "#222",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: mode === "dashboard" ? "0 2px 8px #E3051B22" : undefined,
                transition: "all 0.2s"
              }}
            >Dashboard</button>
            <button
              onClick={() => setMode("responsibility")}
              aria-current={mode === "responsibility"}
              style={{
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 16,
                background: mode === "responsibility" ? PRIMARY_COLOR : "#f0f0f0",
                color: mode === "responsibility" ? "#fff" : "#222",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: mode === "responsibility" ? "0 2px 8px #E3051B22" : undefined,
                transition: "all 0.2s"
              }}
            >By Responsibility</button>
            <button
              onClick={() => setMode("person")}
              aria-current={mode === "person"}
              style={{
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 16,
                background: mode === "person" ? PRIMARY_COLOR : "#f0f0f0",
                color: mode === "person" ? "#fff" : "#222",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: mode === "person" ? "0 2px 8px #E3051B22" : undefined,
                transition: "all 0.2s"
              }}
            >By Person</button>
            <button
              onClick={() => setMode("matrix")}
              aria-current={mode === "matrix"}
              style={{
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 16,
                background: mode === "matrix" ? PRIMARY_COLOR : "#f0f0f0",
                color: mode === "matrix" ? "#fff" : "#222",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: mode === "matrix" ? "0 2px 8px #E3051B22" : undefined,
                transition: "all 0.2s"
              }}
            >Full Matrix</button>
          </div>
        </nav>
      </header>
      <main style={{ maxWidth: 1100, margin: "32px auto 0 auto", padding: "24px 8px", width: "100%" }}>
        {mode === "dashboard" && (
          <DashboardSearch
            persons={persons}
            responsibilities={responsibilities}
            personToResponsibilities={personToResponsibilities}
            responsibilityToPeople={responsibilityToPeople}
          />
        )}
        {mode === "matrix" && getFullMatrix(matrix)}
        {mode === "responsibility" && (
          <ResponsibilityView
            responsibilities={responsibilities}
            responsibilityToPeople={responsibilityToPeople}
            search={search}
            setSearch={setSearch}
            selected={selected}
            setSelected={setSelected}
          />
        )}
        {mode === "person" && (
          <PersonView
            persons={persons}
            personToResponsibilities={personToResponsibilities}
            search={search}
            setSearch={setSearch}
            selected={selected}
            setSelected={setSelected}
          />
        )}
      </main>
    </div>
  );
}

// --- DashboardSearch Component ---
function DashboardSearch({
  persons,
  responsibilities,
  personToResponsibilities,
  responsibilityToPeople,
}: {
  persons: Person[];
  responsibilities: Responsibility[];
  personToResponsibilities: Record<Person, ResponsibilityRole[]>;
  responsibilityToPeople: Record<Responsibility, PersonRole[]>;
}) {
  const [query, setQuery] = useState("");
  const lowerQuery = query.trim().toLowerCase();

  function getRoleKeyFromQuery(q: string) {
    if (!q) return null;
    const ql = q.toLowerCase();
    if (ql.includes("accountable")) return "A";
    if (ql.includes("responsible")) return "R";
    if (ql.includes("consulted")) return "C";
    if (ql.includes("informed")) return "I";
    return null;
  }

  const matchedResponsibilities = responsibilities.filter(
    (r) => typeof r === "string" && r.toLowerCase().includes(lowerQuery)
  );
  const matchedPersons = persons.filter(
    (p) => typeof p === "string" && p.toLowerCase().includes(lowerQuery)
  );
  const roleKey = getRoleKeyFromQuery(query);

  let mixPerson: string | null = null,
    mixRole: RoleKey | null = null;
  persons.forEach((p) => {
    if (lowerQuery.includes(p.toLowerCase())) mixPerson = p;
  });
  ["accountable", "responsible", "consulted", "informed"].forEach((role, idx) => {
    if (lowerQuery.includes(role)) mixRole = ["A", "R", "C", "I"][idx] as RoleKey;
  });

  let results: JSX.Element[] = [];
  if (query.length === 0) {
    results = [];
  } else if (mixPerson && mixRole) {
    const items = personToResponsibilities[mixPerson] || [];
    const filtered = items.filter((i) => i.role === mixRole);
    results = [
      <div key="mix" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: PRIMARY_COLOR, marginBottom: 8 }}>
          {mixPerson} ({ROLE_MAP[mixRole]})
        </div>
        {filtered.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, color: "#222" }}>
            {filtered.map((i) => (
              <li key={i.responsibility}>{i.responsibility}</li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#aaa", fontSize: 15, marginLeft: 8 }}>None</div>
        )}
      </div>,
    ];
  } else if (matchedResponsibilities.length > 0) {
    results = matchedResponsibilities.map((resp, idx) => {
      const people = responsibilityToPeople[resp] || [];
      const groups: Record<RoleKey, string[]> = { A: [], R: [], C: [], I: [] };
      people.forEach(({ person, role }) => {
        if (groups[role as RoleKey]) groups[role as RoleKey].push(person);
      });
      return (
        <div
          key={resp + "-" + idx}
          style={{
            boxShadow: "0 2px 8px #E3051B22",
            borderRadius: 12,
            background: "#fff",
            padding: 20,
            marginBottom: 18,
            border: `1.5px solid ${PRIMARY_COLOR}22`,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18, color: PRIMARY_COLOR, marginBottom: 8 }}>
            {highlightText(resp, query)}
          </div>
          {ROLE_ORDER.map((role) => (
            <div key={role} style={{ marginBottom: 8 }}>
              <RoleChip role={role} />{" "}
              {groups[role].length > 0
                ? groups[role].map((p, i) => {
                    let display;
                    if (typeof p === "string") {
                      display = highlightText(p, query);
                    } else if (typeof p === "object" && p !== null && "name" in p && typeof (p as any).name === "string") {
                      display = highlightText((p as any).name, query);
                    } else {
                      display = highlightText(JSON.stringify(p), query);
                    }
                    return (
                      <span key={i}>
                        {display}
                        {i < groups[role].length - 1 ? ", " : ""}
                      </span>
                    );
                  })
                : <span style={{ color: "#aaa" }}>None</span>}
            </div>
          ))}
        </div>
      );
    });
  } else if (matchedPersons.length > 0) {
    results = matchedPersons.map((person, idx) => {
      const items = personToResponsibilities[person] || [];
      const groups: Record<RoleKey, string[]> = { A: [], R: [], C: [], I: [] };
      items.forEach(({ responsibility, role }) => {
        if (groups[role as RoleKey]) groups[role as RoleKey].push(responsibility);
      });
      return (
        <div
          key={person + "-" + idx}
          style={{
            boxShadow: "0 2px 8px #E3051B22",
            borderRadius: 12,
            background: "#fff",
            padding: 20,
            marginBottom: 18,
            border: `1.5px solid ${PRIMARY_COLOR}22`,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18, color: PRIMARY_COLOR, marginBottom: 8 }}>
            {highlightText(person, query)}
          </div>
          {ROLE_ORDER.map((role) => (
            <div key={role} style={{ marginBottom: 8 }}>
              <RoleChip role={role} />{" "}
              {groups[role].length > 0
                ? groups[role].map((p, i) => {
                    let display;
                    if (typeof p === "string") {
                      display = highlightText(p, query);
                    } else if (typeof p === "object" && p !== null && "name" in p && typeof (p as any).name === "string") {
                      display = highlightText((p as any).name, query);
                    } else {
                      display = highlightText(JSON.stringify(p), query);
                    }
                    return (
                      <span key={i}>
                        {display}
                        {i < groups[role].length - 1 ? ", " : ""}
                      </span>
                    );
                  })
                : <span style={{ color: "#aaa" }}>None</span>}
            </div>
          ))}
        </div>
      );
    });
  } else if (roleKey) {
    let roleResults: JSX.Element[] = [];
    responsibilities.forEach((resp, idx) => {
      const people = (responsibilityToPeople[resp] || []).filter((p) => p.role === roleKey);
      if (people.length > 0) {
        roleResults.push(
          <div
            key={resp + "-" + idx}
            style={{
              boxShadow: "0 2px 8px #E3051B22",
              borderRadius: 12,
              background: "#fff",
              padding: 20,
              marginBottom: 18,
              border: `1.5px solid ${PRIMARY_COLOR}22`,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, color: PRIMARY_COLOR, marginBottom: 8 }}>
              {highlightText(resp, query)}
            </div>
            <RoleChip role={roleKey as RoleKey} /> {people.map((p) => highlightText(p.person, query)).join(", ")}
          </div>
        );
      }
    });
    results = roleResults.length > 0 ? roleResults : [<div key="none" style={{ color: "#aaa", fontSize: 16 }}>No results found.</div>];
  } else {
    results = [<div key="none" style={{ color: "#aaa", fontSize: 16 }}>No results found.</div>];
  }

  return (
    <section aria-label="Dashboard search" style={{ marginTop: 24 }}>
      <div style={{
        position: "sticky",
        top: 80,
        background: "#fff",
        zIndex: 10,
        paddingBottom: 16
      }}>
        <input
          style={{
            width: "100%",
            padding: 16,
            border: `2px solid ${PRIMARY_COLOR}33`,
            borderRadius: 10,
            fontSize: 18,
            outline: "none",
            background: BG_COLOR,
            fontFamily: FONT,
            marginBottom: 32
          }}
          placeholder="Search anything (person, responsibility, role)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          aria-label="Search"
        />
      </div>
      <div>
        {results}
      </div>
    </section>
  );
}

// --- Highlight search terms ---
function highlightText(text: string, query: string) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: "#ffe082", color: "#b71c1c", fontWeight: 700 }}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// --- Role color chips ---
function RoleChip({ role }: { role: RoleKey }) {
  const color =
    role === "A"
      ? PRIMARY_COLOR
      : role === "R"
      ? "#ff9800"
      : role === "C"
      ? "#1976d2"
      : "#43a047";
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 24,
        padding: "2px 10px",
        borderRadius: 12,
        background: color,
        color: "#fff",
        fontWeight: 700,
        fontSize: 14,
        marginRight: 8,
        textAlign: "center"
      }}
      aria-label={ROLE_MAP[role]}
    >
      {ROLE_MAP[role]}
    </span>
  );
}

// --- ResponsibilityView Component ---
function ResponsibilityView({
  responsibilities,
  responsibilityToPeople,
  search,
  setSearch,
  selected,
  setSelected,
}: {
  responsibilities: Responsibility[];
  responsibilityToPeople: Record<Responsibility, PersonRole[]>;
  search: string;
  setSearch: (s: string) => void;
  selected: string;
  setSelected: (s: string) => void;
}) {
  const filteredResponsibilities = useMemo(() => {
    if (!search) return responsibilities;
    return responsibilities.filter((r) => typeof r === "string" && r.toLowerCase().includes(search.toLowerCase()));
  }, [search, responsibilities]);
  const selectedResp = selected || (filteredResponsibilities.length > 0 ? filteredResponsibilities[0] : "");
  const roleGroups = useMemo(() => {
    const people = responsibilityToPeople[selectedResp] || [];
    const groups: Record<RoleKey, string[]> = { A: [], R: [], C: [], I: [] };
    people.forEach(({ person, role }) => {
      if (groups[role as RoleKey]) groups[role as RoleKey].push(person);
    });
    return groups;
  }, [selectedResp, responsibilityToPeople]);

  return (
    <section aria-label="By Responsibility" style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 24, position: "sticky", top: 80, background: "#fff", zIndex: 10, paddingBottom: 16 }}>
        <input
          style={{
            width: "100%",
            padding: 14,
            border: `2px solid ${PRIMARY_COLOR}33`,
            borderRadius: 8,
            fontSize: 16,
            outline: "none",
            background: BG_COLOR,
            fontFamily: FONT
          }}
          placeholder="Search responsibility..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoComplete="off"
          aria-label="Search responsibility"
        />
      </div>
      <div style={{ marginBottom: 32 }}>
        {filteredResponsibilities.length === 0 && (
          <div style={{ color: "#888", fontSize: 16, textAlign: "center" }}>No responsibilities found.</div>
        )}
        {filteredResponsibilities.map((resp, idx) => (
          <div key={resp + '-' + idx}>
            <div
              onClick={() => setSelected(resp)}
              style={{
                padding: "16px 20px",
                borderRadius: 10,
                background: resp === selectedResp ? PRIMARY_COLOR : "#f5f5f7",
                color: resp === selectedResp ? "#fff" : "#222",
                fontWeight: 700,
                fontSize: 18,
                marginBottom: 10,
                boxShadow: resp === selectedResp ? "0 2px 8px #E3051B22" : undefined,
                letterSpacing: 0.2,
                border: resp === selectedResp ? `2px solid ${PRIMARY_COLOR}` : "1.5px solid #eee",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              tabIndex={0}
              aria-selected={resp === selectedResp}
              aria-label={`Show details for ${resp}`}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") setSelected(resp);
              }}
            >
              {highlightText(resp, search)}
            </div>
            {resp === selected && (
              <div style={{ marginTop: 8, marginBottom: 18 }}>
                {ROLE_ORDER.map((role) => (
                  <div key={role} style={{ marginBottom: 14 }}>
                    <RoleChip role={role} />
                    {roleGroups[role].length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, color: "#222" }}>
                        {roleGroups[role].map((person) => (
                          <li key={person}>{highlightText(person, search)}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: "#aaa", fontSize: 15, marginLeft: 8 }}>None</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// --- PersonView Component ---
function PersonView({
  persons,
  personToResponsibilities,
  search,
  setSearch,
  selected,
  setSelected,
}: {
  persons: Person[];
  personToResponsibilities: Record<Person, ResponsibilityRole[]>;
  search: string;
  setSearch: (s: string) => void;
  selected: string;
  setSelected: (s: string) => void;
}) {
  const filteredPersons = useMemo(() => {
    if (!search) return persons;
    return persons.filter((p) => typeof p === "string" && p.toLowerCase().includes(search.toLowerCase()));
  }, [search, persons]);
  const selectedPerson = selected || (filteredPersons.length > 0 ? filteredPersons[0] : "");
  const personRoles = useMemo(() => {
    const items = personToResponsibilities[selectedPerson] || [];
    const groups: Record<RoleKey, string[]> = { A: [], R: [], C: [], I: [] };
    items.forEach(({ responsibility, role }) => {
      if (groups[role as RoleKey]) groups[role as RoleKey].push(responsibility);
    });
    return groups;
  }, [selectedPerson, personToResponsibilities]);

  return (
    <section aria-label="By Person" style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 24, position: "sticky", top: 80, background: "#fff", zIndex: 10, paddingBottom: 16 }}>
        <input
          style={{
            width: "100%",
            padding: 14,
            border: `2px solid ${PRIMARY_COLOR}33`,
            borderRadius: 8,
            fontSize: 16,
            outline: "none",
            background: BG_COLOR,
            fontFamily: FONT
          }}
          placeholder="Search person..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setSelected("");
          }}
          autoComplete="off"
          aria-label="Search person"
        />
      </div>
      <div style={{ marginBottom: 32 }}>
        {filteredPersons.length === 0 && (
          <div style={{ color: "#888", fontSize: 16, textAlign: "center" }}>No people found.</div>
        )}
        {filteredPersons.map((person, idx) => (
          <div
            key={person + '-' + idx}
            onClick={() => setSelected(person)}
            style={{
              padding: "12px 18px",
              marginBottom: 8,
              borderRadius: 8,
              background: person === selectedPerson ? PRIMARY_COLOR : "#f5f5f7",
              color: person === selectedPerson ? "#fff" : "#222",
              fontWeight: person === selectedPerson ? 700 : 500,
              fontSize: 17,
              cursor: "pointer",
              border: person === selectedPerson ? `2px solid ${PRIMARY_COLOR}` : "1.5px solid #eee",
              transition: "all 0.15s",
              boxShadow: person === selectedPerson ? `0 2px 8px #E3051B22` : undefined,
            }}
            tabIndex={0}
            aria-selected={person === selectedPerson}
            aria-label={`Show details for ${person}`}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") setSelected(person);
            }}
          >
            {highlightText(person, search)}
          </div>
        ))}
      </div>
      {selectedPerson && (
        <div style={{ marginTop: 16 }}>
          {ROLE_ORDER.map((role) => (
            <div key={role} style={{ marginBottom: 18 }}>
              <RoleChip role={role} />
              {personRoles[role].length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, color: "#222" }}>
                  {personRoles[role].map((resp) => (
                    <li key={resp}>{highlightText(resp, search)}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "#aaa", fontSize: 15, marginLeft: 8 }}>None</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
} 