import { useEffect, useMemo, useState } from "react";

const normalizarSecciones = (secciones = []) => (
  secciones.filter((seccion) => seccion?.id && seccion?.etiqueta)
);

export function NavegacionSecciones({ secciones = [] }) {
  const seccionesDisponibles = useMemo(
    () => normalizarSecciones(secciones),
    [secciones],
  );
  const claveSecciones = seccionesDisponibles
    .map((seccion) => `${seccion.id}:${seccion.etiqueta}`)
    .join("|");
  const [seccionActiva, setSeccionActiva] = useState(
    seccionesDisponibles[0]?.id || "",
  );

  useEffect(() => {
    const elementos = seccionesDisponibles
      .map((seccion) => document.getElementById(seccion.id))
      .filter(Boolean);

    if (elementos.length === 0) {
      setSeccionActiva("");
      return undefined;
    }

    let animacionPendiente = 0;
    const actualizarSeccionActiva = () => {
      const limiteSuperior = 130;
      let candidata = elementos[0];

      elementos.forEach((elemento) => {
        if (elemento.getBoundingClientRect().top <= limiteSuperior) {
          candidata = elemento;
        }
      });

      setSeccionActiva(candidata.id);
    };
    const solicitarActualizacion = () => {
      window.cancelAnimationFrame(animacionPendiente);
      animacionPendiente = window.requestAnimationFrame(
        actualizarSeccionActiva,
      );
    };

    const seccionDelHash = window.location.hash.slice(1);
    setSeccionActiva(
      elementos.some((elemento) => elemento.id === seccionDelHash)
        ? seccionDelHash
        : elementos[0].id,
    );
    solicitarActualizacion();
    window.addEventListener("scroll", solicitarActualizacion, {
      passive: true,
    });
    window.addEventListener("resize", solicitarActualizacion);

    return () => {
      window.cancelAnimationFrame(animacionPendiente);
      window.removeEventListener("scroll", solicitarActualizacion);
      window.removeEventListener("resize", solicitarActualizacion);
    };
    // La clave representa el contenido estable; evita reiniciar el scrollspy
    // cuando el padre recrea el mismo array de secciones al renderizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSecciones]);

  const irASeccion = (seccionId) => {
    const destino = document.getElementById(seccionId);
    if (!destino) return;

    const reducirMovimiento = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    destino.scrollIntoView({
      behavior: reducirMovimiento ? "auto" : "smooth",
      block: "start",
    });
    setSeccionActiva(seccionId);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#${seccionId}`,
    );
  };

  if (seccionesDisponibles.length === 0) return null;

  return (
    <>
      <span className="secondary-sidebar-section-title">En esta página</span>
      {seccionesDisponibles.map((seccion) => (
        <button
          className={`secondary-sidebar-section-link${
            seccionActiva === seccion.id ? " is-active" : ""
          }`}
          type="button"
          key={seccion.id}
          aria-current={
            seccionActiva === seccion.id ? "location" : undefined
          }
          onClick={() => irASeccion(seccion.id)}
        >
          <span aria-hidden="true">↳</span>
          {seccion.etiqueta}
        </button>
      ))}
    </>
  );
}
