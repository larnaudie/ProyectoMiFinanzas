import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";

export const useCotizacionUi = (habilitada) => {
  const [cotizacion, setCotizacion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(
    async (forzar = false) => {
      if (!habilitada) return;

      setCargando(true);
      setError("");
      try {
        const response = await api.get(
          `/cotizaciones/ui${forzar ? "?actualizar=true" : ""}`,
        );
        setCotizacion(response.data.cotizacion || null);
      } catch (apiError) {
        console.error("Error al consultar la cotización de UI:", apiError);
        setError(
          apiError.response?.data?.message
          || "No se pudo consultar la cotización del BCU.",
        );
      } finally {
        setCargando(false);
      }
    },
    [habilitada],
  );

  useEffect(() => {
    if (habilitada) {
      cargar(false);
    } else {
      setCotizacion(null);
      setError("");
    }
  }, [cargar, habilitada]);

  return {
    cotizacion,
    cargando,
    error,
    actualizar: () => cargar(true),
  };
};
