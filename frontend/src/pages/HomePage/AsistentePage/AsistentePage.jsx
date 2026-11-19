import { useMemo, useState } from "react";
import { api } from "../../../services/api.js";

const PREGUNTAS_SUGERIDAS = [
  "¿Cómo fue financieramente este mes?",
  "¿Qué pagos mensuales todavía me faltan?",
  "¿En qué subcategorías gasté más este año?",
  "Explicame la diferencia entre mi resultado y mis saldos bancarios.",
];

const ETIQUETAS_CONSULTA = {
  obtener_estado_general: "Cuentas, saldos y compromisos",
  obtener_resumen_periodo: "Resumen del período",
  buscar_movimientos: "Movimientos",
  obtener_pagos_mensuales: "Checklist mensual",
};

const mensajeInicial = {
  role: "assistant",
  content:
    "Hola, Pablo. Puedo analizar tus cuentas, movimientos, transferencias, pagos mensuales, préstamos y deudas. Solo consulto información: no puedo crear, editar ni eliminar nada.",
  consultas: [],
};

function AsistentePage() {
  const [mensajes, setMensajes] = useState([mensajeInicial]);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const historial = useMemo(
    () => mensajes
      .filter((mensaje) => mensaje !== mensajeInicial)
      .slice(-10)
      .map(({ role, content }) => ({ role, content })),
    [mensajes],
  );

  const consultar = async (texto) => {
    const preguntaLimpia = String(texto || "").trim();
    if (!preguntaLimpia || enviando) return;

    setError("");
    setPregunta("");
    setMensajes((actuales) => [
      ...actuales,
      { role: "user", content: preguntaLimpia, consultas: [] },
    ]);
    setEnviando(true);

    try {
      const response = await api.post("/asistente/consultar", {
        pregunta: preguntaLimpia,
        historial,
      });
      setMensajes((actuales) => [
        ...actuales,
        {
          role: "assistant",
          content: response.data.respuesta,
          consultas: response.data.consultasRealizadas || [],
        },
      ]);
    } catch (apiError) {
      const mensaje = apiError.response?.data?.message
        || "No pude completar el análisis. Intentá nuevamente en unos segundos.";
      setError(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const enviarFormulario = (event) => {
    event.preventDefault();
    consultar(pregunta);
  };

  return (
    <main className="assistant-page">
      <header className="assistant-hero">
        <div>
          <span className="assistant-eyebrow">Análisis guiado por tus propios datos</span>
          <h1>Asistente financiero</h1>
          <p>
            Preguntale por un mes, una cuenta, un gasto o una diferencia. Te
            mostrará las cifras y la fórmula que usó para llegar a la respuesta.
          </p>
        </div>
        <div className="assistant-readonly-badge">
          <span aria-hidden="true">◉</span>
          <div>
            <strong>Solo lectura</strong>
            <small>No puede modificar tus datos</small>
          </div>
        </div>
      </header>

      <section className="assistant-layout">
        <aside className="assistant-suggestions">
          <span>Podés empezar por acá</span>
          <div>
            {PREGUNTAS_SUGERIDAS.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                disabled={enviando}
                onClick={() => consultar(sugerencia)}
              >
                {sugerencia}
              </button>
            ))}
          </div>
          <p>
            El asistente consulta únicamente la información asociada a tu
            sesión. No guarda este chat en la aplicación.
          </p>
        </aside>

        <section className="assistant-chat" aria-label="Conversación con el asistente">
          <div className="assistant-messages" aria-live="polite">
            {mensajes.map((mensaje, indice) => (
              <article
                className={`assistant-message is-${mensaje.role}`}
                key={`${mensaje.role}-${indice}`}
              >
                <span>{mensaje.role === "user" ? "Vos" : "Asistente"}</span>
                <p>{mensaje.content}</p>
                {mensaje.consultas?.length > 0 && (
                  <div className="assistant-evidence">
                    <small>Datos consultados:</small>
                    {mensaje.consultas.map((consulta) => (
                      <em key={consulta}>
                        {ETIQUETAS_CONSULTA[consulta] || consulta}
                      </em>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {enviando && (
              <article className="assistant-message is-assistant is-thinking">
                <span>Asistente</span>
                <p>Estoy consultando tus datos y comprobando los cálculos…</p>
              </article>
            )}
          </div>

          {error && <p className="assistant-error" role="alert">{error}</p>}

          <form className="assistant-composer" onSubmit={enviarFormulario}>
            <label htmlFor="assistant-question">Tu consulta</label>
            <div>
              <textarea
                id="assistant-question"
                value={pregunta}
                maxLength={2000}
                rows={3}
                placeholder="Ej.: Recibí US$ 4.000 en noviembre, ¿cuánto ahorré realmente?"
                onChange={(event) => setPregunta(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    enviarFormulario(event);
                  }
                }}
              />
              <button type="submit" disabled={enviando || pregunta.trim().length < 2}>
                {enviando ? "Analizando…" : "Consultar"}
              </button>
            </div>
            <small>Enter para enviar · Shift + Enter para una nueva línea</small>
          </form>
        </section>
      </section>
    </main>
  );
}

export default AsistentePage;
