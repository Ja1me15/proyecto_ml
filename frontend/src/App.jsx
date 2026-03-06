import { useEffect, useMemo, useState } from "react";
import { predict } from "./api";
import { OPTIONS } from "./options";
import "./App.css";

const SOLIDEZ_0 = {
  SUPERVISOR: "SUPERSOCIEDADES",
  "REGIÓN": "COSTA ATLÁNTICA",
  "DEPARTAMENTO DOMICILIO": "ATLANTICO",
  "CIUDAD DOMICILIO": "BARRANQUILLA",
  CIIU: "5611",
  MACROSECTOR: "SERVICIOS",
  "Año de Corte": 2022,
  "INGRESOS OPERACIONALES": 700000000,
  "GANANCIA (PÉRDIDA)": -220000000,
  "TOTAL ACTIVOS": 900000000,
  "TOTAL PASIVOS": 820000000,
  "TOTAL PATRIMONIO": 80000000,
};

const SOLIDEZ_1 = {
  SUPERVISOR: "SUPERSOCIEDADES",
  "REGIÓN": "COSTA ATLÁNTICA",
  "DEPARTAMENTO DOMICILIO": "ATLANTICO",
  "CIUDAD DOMICILIO": "BARRANQUILLA",
  CIIU: "4711",
  MACROSECTOR: "COMERCIO",
  "Año de Corte": 2022,
  "INGRESOS OPERACIONALES": 1200000000,
  "GANANCIA (PÉRDIDA)": -50000000,
  "TOTAL ACTIVOS": 1600000000,
  "TOTAL PASIVOS": 1200000000,
  "TOTAL PATRIMONIO": 400000000,
};

const SOLIDEZ_2 = {
  SUPERVISOR: "SUPERSOCIEDADES",
  "REGIÓN": "CENTRO - ORIENTE",
  "DEPARTAMENTO DOMICILIO": "TOLIMA",
  "CIUDAD DOMICILIO": "IBAGUE",
  CIIU: "4661",
  MACROSECTOR: "COMERCIO",
  "Año de Corte": 2022,
  "INGRESOS OPERACIONALES": 2400000000,
  "GANANCIA (PÉRDIDA)": 60000000,
  "TOTAL ACTIVOS": 2800000000,
  "TOTAL PASIVOS": 1500000000,
  "TOTAL PATRIMONIO": 1300000000,
};

const SOLIDEZ_3 = {
  SUPERVISOR: "SUPERSOCIEDADES",
  "REGIÓN": "CENTRO - ORIENTE",
  "DEPARTAMENTO DOMICILIO": "TOLIMA",
  "CIUDAD DOMICILIO": "IBAGUE",
  CIIU: "1921",
  MACROSECTOR: "MANUFACTURA",
  "Año de Corte": 2022,
  "INGRESOS OPERACIONALES": 5200000000,
  "GANANCIA (PÉRDIDA)": 520000000,
  "TOTAL ACTIVOS": 6500000000,
  "TOTAL PASIVOS": 2200000000,
  "TOTAL PATRIMONIO": 4300000000,
};

/* =========================
   HELPERS
========================= */
function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function formatMoney(n) {
  if (!Number.isFinite(n)) return "-";
  try {
    return new Intl.NumberFormat("es-CO").format(Math.round(n));
  } catch {
    return String(n);
  }
}

function toneToDotClass(tone) {
  if (tone === "good") return "good";
  if (tone === "bad") return "bad";
  return "warn";
}

function toneToRowStyle(tone) {
  const map = {
    good: {
      borderLeft: "4px solid rgba(34,197,94,0.65)",
      background: "rgba(34,197,94,0.06)",
    },
    warn: {
      borderLeft: "4px solid rgba(245,158,11,0.65)",
      background: "rgba(245,158,11,0.06)",
    },
    bad: {
      borderLeft: "4px solid rgba(239,68,68,0.65)",
      background: "rgba(239,68,68,0.06)",
    },
  };
  return map[tone] || map.warn;
}

/* =========================
   RATIOS: tabla pro + lectura
========================= */
function ratioInterpretation(ratios = {}) {
  const end = ratios.ratio_endeudamiento;
  const mar = ratios.margen_ganancia;
  const roa = ratios.roa;
  const apal = ratios.apalancamiento;

  const classify = {
    endeudamiento: (x) => {
      if (!Number.isFinite(x)) return { tone: "warn", text: "No disponible" };
      if (x < 0.5) return { tone: "good", text: "Bajo endeudamiento (< 0.50)" };
      if (x < 0.7) return { tone: "warn", text: "Moderado (0.50–0.69)" };
      return { tone: "bad", text: "Alto (≥ 0.70)" };
    },
    margen: (x) => {
      if (!Number.isFinite(x)) return { tone: "warn", text: "No disponible" };
      if (x >= 0.1) return { tone: "good", text: "Saludable (≥ 10%)" };
      if (x >= 0.0) return { tone: "warn", text: "Bajo pero positivo (0–9.9%)" };
      return { tone: "bad", text: "Negativo (pérdidas)" };
    },
    roa: (x) => {
      if (!Number.isFinite(x)) return { tone: "warn", text: "No disponible" };
      if (x >= 0.05) return { tone: "good", text: "Bueno (≥ 5%)" };
      if (x >= 0.0) return { tone: "warn", text: "Leve/estable (0–4.9%)" };
      return { tone: "bad", text: "Negativo (pérdida sobre activos)" };
    },
    apal: (x) => {
      if (!Number.isFinite(x)) return { tone: "warn", text: "No disponible" };
      if (x < 3) return { tone: "good", text: "Sano (< 3)" };
      if (x < 5) return { tone: "warn", text: "Moderado (3–4.9)" };
      return { tone: "bad", text: "Alto (≥ 5)" };
    },
  };

  return [
    {
      key: "ratio_endeudamiento",
      nombre: "Endeudamiento",
      valor: end,
      queEs: "Pasivos / Activos. Qué proporción de la empresa está financiada con deuda.",
      lectura: classify.endeudamiento(end),
      formato: (x) => (Number.isFinite(x) ? x.toFixed(3) : "-"),
    },
    {
      key: "margen_ganancia",
      nombre: "Margen",
      valor: mar,
      queEs: "Ganancia / Ingresos. De cada $100 vendidos, cuánto gana o pierde.",
      lectura: classify.margen(mar),
      formato: (x) => (Number.isFinite(x) ? (x * 100).toFixed(2) + "%" : "-"),
    },
    {
      key: "roa",
      nombre: "ROA",
      valor: roa,
      queEs: "Ganancia / Activos. Rentabilidad de todo lo que posee la empresa.",
      lectura: classify.roa(roa),
      formato: (x) => (Number.isFinite(x) ? (x * 100).toFixed(2) + "%" : "-"),
    },
    {
      key: "apalancamiento",
      nombre: "Apalancamiento",
      valor: apal,
      queEs: "Activos / Patrimonio. Qué tan “apalancada” está con deuda vs capital propio.",
      lectura: classify.apal(apal),
      formato: (x) => (Number.isFinite(x) ? x.toFixed(2) : "-"),
    },
  ];
}

/* =========================
   APP
========================= */
export default function App() {
  const [form, setForm] = useState(SOLIDEZ_3);
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const cities = useMemo(() => {
    const d = form["DEPARTAMENTO DOMICILIO"];
    return OPTIONS.ciudadesPorDepartamento?.[d] || [];
  }, [form]);

  useEffect(() => {
    if (!cities.length) return;
    if (!cities.includes(form["CIUDAD DOMICILIO"])) {
      setField("CIUDAD DOMICILIO", cities[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form["DEPARTAMENTO DOMICILIO"]]);

  const ciiuHint = useMemo(() => {
    const raw = String(form.CIIU ?? "").trim();
    if (!raw) return "Código CIIU: normalmente 4 dígitos (ej: 4711, 5611).";
    if (!/^\d+$/.test(raw)) return "CIIU debería ser numérico (solo dígitos).";
    if (raw.length !== 4) return "CIIU usualmente tiene 4 dígitos.";
    return "✅ CIIU válido (formato 4 dígitos).";
  }, [form.CIIU]);

  const riskMeta = useMemo(() => {
    if (!out) return null;
    const p = out.proba_riesgo;
    if (p >= 0.5)
      return {
        tone: "bad",
        label: "ALTO",
        desc:
          "Probabilidad alta de riesgo financiero según patrones del dataset. Requiere revisión.",
      };
    if (p >= 0.25)
      return {
        tone: "warn",
        label: "MEDIO",
        desc:
          "Señales moderadas de riesgo. Recomienda revisar endeudamiento y rentabilidad.",
      };
    return {
      tone: "good",
      label: "BAJO",
      desc:
        "Baja probabilidad de riesgo. No se observan patrones fuertes de alerta.",
    };
  }, [out]);

  const perfMeta = useMemo(() => {
    if (!out) return null;
    const s = out.indice_desempeno;
    if (s >= 0)
      return {
        label: "FAVORABLE",
        tone: "good",
        desc: "Índice ≥ 0 sugiere desempeño relativamente favorable/estable.",
      };
    if (s >= -0.25)
      return {
        label: "ESTABLE",
        tone: "good",
        desc:
          "Cerca a 0 suele indicar operación estable (sin deterioro fuerte).",
      };
    if (s >= -0.6)
      return {
        label: "MODERADO",
        tone: "warn",
        desc:
          "Negativo moderado: desempeño debilitado (margen/ROA/endeudamiento pueden pesar).",
      };
    return {
      label: "DÉBIL",
      tone: "bad",
      desc:
        "Negativo marcado: desempeño bajo. Suele asociarse a pérdidas y/o alto apalancamiento.",
    };
  }, [out]);

  const solMeta = useMemo(() => {
    if (!out) return null;
    const k = out.nivel_solidez;
    const map = {
      3: {
        label: "ALTA",
        tone: "good",
        desc:
          "Estructura sólida: equilibrio entre activos, pasivos y rentabilidad.",
      },
      2: {
        label: "MEDIA",
        tone: "warn",
        desc: "Solidez media: estructura aceptable con aspectos a vigilar.",
      },
      1: {
        label: "BAJA",
        tone: "warn",
        desc:
          "Solidez baja: riesgo de estrés financiero ante cambios adversos.",
      },
      0: {
        label: "MUY BAJA",
        tone: "bad",
        desc:
          "Solidez muy baja: señales fuertes de vulnerabilidad financiera.",
      },
    };
    return map[k] || { label: "N/A", tone: "warn", desc: "No disponible." };
  }, [out]);

  const executive = useMemo(() => {
    if (!out || !riskMeta || !perfMeta || !solMeta) return null;

    const r = out.ratios || {};
    const recs = [];
    if (Number.isFinite(r.ratio_endeudamiento) && r.ratio_endeudamiento >= 0.7)
      recs.push("alto endeudamiento");
    if (Number.isFinite(r.margen_ganancia) && r.margen_ganancia < 0)
      recs.push("margen negativo");
    if (Number.isFinite(r.roa) && r.roa < 0) recs.push("ROA negativo");
    if (Number.isFinite(r.apalancamiento) && r.apalancamiento >= 5)
      recs.push("apalancamiento alto");

    const recText =
      recs.length > 0
        ? `Principales alertas: ${recs.join(", ")}.`
        : "No se observan alertas fuertes en ratios principales.";

    const headline = `Riesgo ${riskMeta.label.toLowerCase()}, desempeño ${perfMeta.label.toLowerCase()} y solidez ${solMeta.label.toLowerCase()}.`;

    let action = "Sugerencia: mantener monitoreo periódico.";
    if (riskMeta.tone === "bad" || solMeta.tone === "bad") {
      action =
        "Sugerencia: priorizar plan de mejora (pasivos, rentabilidad y liquidez).";
    } else if (riskMeta.tone === "warn" || perfMeta.tone === "warn") {
      action =
        "Sugerencia: revisar estrategia de costos/ventas y estructura de deuda.";
    }

    return { headline, recText, action, tone: riskMeta.tone };
  }, [out, riskMeta, perfMeta, solMeta]);

  async function onPredict() {
    setLoading(true);
    setErr("");
    setOut(null);

    try {
      const payload = {
        ...form,
        "Año de Corte": Number(form["Año de Corte"]),
        "INGRESOS OPERACIONALES": Number(form["INGRESOS OPERACIONALES"]),
        "GANANCIA (PÉRDIDA)": Number(form["GANANCIA (PÉRDIDA)"]),
        "TOTAL ACTIVOS": Number(form["TOTAL ACTIVOS"]),
        "TOTAL PASIVOS": Number(form["TOTAL PASIVOS"]),
        "TOTAL PATRIMONIO": Number(form["TOTAL PATRIMONIO"]),
        CIIU: String(form.CIIU).trim(),
      };

      const res = await predict(payload);
      setOut(res);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const riskBarWidth = useMemo(() => {
    if (!out) return "0%";
    return `${Math.round(clamp01(out.proba_riesgo) * 100)}%`;
  }, [out]);

  return (
    <div className="page">
      <div className="container">
        {/* TOP */}
        <div className="topbar">
          <div className="brand">
            <div className="brandIcon" aria-hidden>
              SF
            </div>
            <div>
              <h1>Sistema de Scoring Financiero</h1>
              <p>React (Front) + FastAPI (API) · CatBoost + NGBoost + Ordinal</p>
            </div>
          </div>

          <div className="actions">
            <button className="pill" onClick={() => { setOut(null); setErr(""); setForm(SOLIDEZ_0); }}>
              <span className="dot bad" /> Solidez 0
            </button>
            <button className="pill" onClick={() => { setOut(null); setErr(""); setForm(SOLIDEZ_1); }}>
              <span className="dot bad" /> Solidez 1
            </button>
            <button className="pill" onClick={() => { setOut(null); setErr(""); setForm(SOLIDEZ_2); }}>
              <span className="dot good" /> Solidez 2
            </button>
            <button className="pill" onClick={() => { setOut(null); setErr(""); setForm(SOLIDEZ_3); }}>
              <span className="dot good" /> Solidez 3
            </button>
          </div>
        </div>

        <div className="grid">
          {/* FORM */}
          <div className="card">
            <div className="cardHeader">
              <div>
                <div className="cardTitle">Datos de entrada</div>
                <div className="cardSub">
                  Selecciona contexto (categorías del dataset) y completa valores contables.
                </div>
              </div>
              <div className="badgeMini">Validado por categorías</div>
            </div>

            <div className="section">
              <div className="sectionTop">
                <div className="sectionName">Contexto</div>
                <div className="sectionHint">Categorías usadas en entrenamiento</div>
              </div>

              <div className="formGrid">
                <div className="field">
                  <span>SUPERVISOR</span>
                  <select value={form.SUPERVISOR || ""} onChange={(e) => setField("SUPERVISOR", e.target.value)}>
                    <option value="" disabled>Selecciona supervisor...</option>
                    {OPTIONS.supervisores.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="field">
                  <span>REGIÓN</span>
                  <select value={form["REGIÓN"] || ""} onChange={(e) => setField("REGIÓN", e.target.value)}>
                    <option value="" disabled>Selecciona región...</option>
                    {OPTIONS.regiones.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="field">
                  <span>DEPARTAMENTO</span>
                  <select value={form["DEPARTAMENTO DOMICILIO"] || ""} onChange={(e) => setField("DEPARTAMENTO DOMICILIO", e.target.value)}>
                    <option value="" disabled>Selecciona departamento...</option>
                    {OPTIONS.departamentos.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="field">
                  <span>CIUDAD</span>
                  <select value={form["CIUDAD DOMICILIO"] || ""} onChange={(e) => setField("CIUDAD DOMICILIO", e.target.value)}>
                    <option value="" disabled>Selecciona ciudad...</option>
                    {(cities.length ? cities : [form["CIUDAD DOMICILIO"]]).filter(Boolean).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <small>La lista cambia según el departamento.</small>
                </div>

                <div className="field">
                  <span>MACROSECTOR</span>
                  <select value={form.MACROSECTOR || ""} onChange={(e) => setField("MACROSECTOR", e.target.value)}>
                    <option value="" disabled>Selecciona macrosector...</option>
                    {OPTIONS.macrosector.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="field wide">
                  <span>CIIU</span>
                  <input value={form.CIIU ?? ""} onChange={(e) => setField("CIIU", e.target.value)} placeholder="Ej: 4711" inputMode="numeric" />
                  <small>{ciiuHint}</small>
                </div>

                <div className="field wide">
                  <span>Año de Corte</span>
                  <input type="number" value={form["Año de Corte"]} onChange={(e) => setField("Año de Corte", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="section">
              <div className="sectionTop">
                <div className="sectionName">Información contable</div>
                <div className="sectionHint">En COP. Puedes pegar valores grandes.</div>
              </div>

              <div className="formGrid">
                <div className="field">
                  <span>Ingresos operacionales</span>
                  <input type="number" value={form["INGRESOS OPERACIONALES"]} onChange={(e) => setField("INGRESOS OPERACIONALES", e.target.value)} />
                  <small>Ej: {formatMoney(3500000000)}</small>
                </div>

                <div className="field">
                  <span>Ganancia (pérdida)</span>
                  <input type="number" value={form["GANANCIA (PÉRDIDA)"]} onChange={(e) => setField("GANANCIA (PÉRDIDA)", e.target.value)} />
                  <small>Negativo si hubo pérdida.</small>
                </div>

                <div className="field">
                  <span>Total activos</span>
                  <input type="number" value={form["TOTAL ACTIVOS"]} onChange={(e) => setField("TOTAL ACTIVOS", e.target.value)} />
                </div>

                <div className="field">
                  <span>Total pasivos</span>
                  <input type="number" value={form["TOTAL PASIVOS"]} onChange={(e) => setField("TOTAL PASIVOS", e.target.value)} />
                </div>

                <div className="field wide">
                  <span>Total patrimonio</span>
                  <input type="number" value={form["TOTAL PATRIMONIO"]} onChange={(e) => setField("TOTAL PATRIMONIO", e.target.value)} />
                </div>
              </div>
            </div>

            <button className="cta" onClick={onPredict} disabled={loading}>
              {loading ? "Calculando..." : "Evaluar situación financiera"}
            </button>

            {err && <div className="error">{err}</div>}
          </div>

          {/* RESULTS */}
          <div className="card">
            <div className="cardHeader">
              <div>
                <div className="cardTitle">Resultados e interpretación</div>
                <div className="cardSub">
                  Resumen ejecutivo + tabla interpretativa para lectura rápida.
                </div>
              </div>
              <div className="badgeMini">API /predict</div>
            </div>

            {!out ? (
              <div className="empty">Ejecuta una predicción para ver resultados.</div>
            ) : (
              <div className="resultsWrap">
                {executive && (
                  <div className="section" style={{ ...toneToRowStyle(executive.tone), borderRadius: 18 }}>
                    <div className="sectionTop" style={{ marginBottom: 8 }}>
                      <div className="sectionName">Resumen ejecutivo</div>
                      <div className="badgeMini">
                        {riskMeta.label} riesgo · {perfMeta.label} desempeño · {solMeta.label} solidez
                      </div>
                    </div>
                    <div className="miniNote" style={{ fontSize: 13.5 }}>
                      <b>{executive.headline}</b><br />
                      {executive.recText}<br />
                      <b>{executive.action}</b>
                    </div>
                  </div>
                )}

                <div className="kpiGrid">
                  <div className="kpi">
                    <div className="kpiLabel">Probabilidad de riesgo</div>
                    <div className="kpiVal">{out.proba_riesgo.toFixed(3)}</div>

                    <div className={`pillStatus ${riskMeta?.tone || "warn"}`}>
                      <span className={`dot ${toneToDotClass(riskMeta?.tone)}`} style={{ width: 10, height: 10 }} />
                      {riskMeta?.label || "N/A"}
                    </div>

                    <div className="progress" title="0 = bajo, 1 = alto">
                      <div className="bar" style={{ width: riskBarWidth }} />
                    </div>
                    <div className="miniNote" style={{ marginTop: 8 }}>
                      {riskMeta?.desc}
                    </div>
                  </div>

                  <div className="kpi">
                    <div className="kpiLabel">Índice de desempeño</div>
                    <div className="kpiVal">{out.indice_desempeno.toFixed(5)}</div>

                    <div className={`pillStatus ${perfMeta?.tone || "warn"}`}>
                      {perfMeta?.label || "N/A"}
                    </div>
                    <div className="miniNote" style={{ marginTop: 8 }}>
                      {perfMeta?.desc}
                    </div>
                  </div>

                  <div className="kpi">
                    <div className="kpiLabel">Nivel de solidez (0–3)</div>
                    <div className="kpiVal">{out.nivel_solidez}</div>

                    <div className={`pillStatus ${solMeta?.tone || "warn"}`}>
                      {solMeta?.label || "N/A"}
                    </div>
                    <div className="miniNote" style={{ marginTop: 8 }}>
                      {solMeta?.desc}
                    </div>
                  </div>
                </div>

                <div className="divider" />

                <table className="table">
                  <thead>
                    <tr>
                      <th>Objetivo</th>
                      <th>Valor</th>
                      <th>Interpretación</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={toneToRowStyle(riskMeta.tone)}>
                      <td><b>Riesgo financiero</b> (CatBoost)</td>
                      <td>{out.proba_riesgo.toFixed(3)}</td>
                      <td className="miniNote">
                        Probabilidad entre 0 y 1. Cerca de 0 = bajo riesgo, cerca de 1 = alto riesgo.
                        Umbrales demo: <b>&lt;0.25</b> bajo, <b>0.25–0.50</b> medio, <b>&gt;=0.50</b> alto.
                      </td>
                    </tr>

                    <tr style={toneToRowStyle(perfMeta.tone)}>
                      <td><b>Índice de desempeño</b> (NGBoost)</td>
                      <td>{out.indice_desempeno.toFixed(5)}</td>
                      <td className="miniNote">
                        Índice continuo (no es porcentaje). Cerca de <b>0</b> suele indicar estabilidad.
                        Más negativo sugiere desempeño más débil.
                      </td>
                    </tr>

                    <tr style={toneToRowStyle(solMeta.tone)}>
                      <td><b>Solidez</b> (Ordinal)</td>
                      <td>{out.nivel_solidez}</td>
                      <td className="miniNote">
                        Escala ordinal: <b>0</b> muy baja, <b>1</b> baja, <b>2</b> media, <b>3</b> alta.
                        Resume estructura financiera (apalancamiento + rentabilidad + balance).
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="divider" />

                <div>
                  <div className="cardTitle" style={{ marginBottom: 8 }}>
                    Ratios
                  </div>

                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ratio</th>
                        <th>Valor</th>
                        <th>Qué significa</th>
                        <th>Lectura rápida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratioInterpretation(out.ratios).map((r) => (
                        <tr key={r.key} style={toneToRowStyle(r.lectura.tone)}>
                          <td><b>{r.nombre}</b></td>
                          <td>{r.formato(r.valor)}</td>
                          <td className="miniNote">{r.queEs}</td>
                          <td className="miniNote"><b>{r.lectura.text}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="miniNote" style={{ marginTop: 10 }}>
                    Estos ratios se calculan automáticamente a partir de tus datos contables y ayudan a entender
                    por qué el modelo estima <b>riesgo</b>, <b>desempeño</b> y <b>solidez</b>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}