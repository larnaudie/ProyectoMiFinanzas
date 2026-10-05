const normalizar = (valor) => String(valor || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9 ]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export const esDebitoProvisional = (movimiento) => (
  normalizar(movimiento?.detalleOriginal || movimiento?.detalleNormalizado)
    .includes("debito a confirmar")
);

const codigoAutorizacionProvisional = (movimiento) => {
  const detalle = normalizar(
    movimiento?.detalleOriginal || movimiento?.detalleNormalizado,
  );
  const coincidencia = detalle.match(/\bcompra\s+(\d{6,})\b/);
  return coincidencia?.[1]?.slice(-6) || "";
};

const identificadoresDefinitivos = (movimiento) => [
  movimiento?.referenciaBanco,
  movimiento?.detalleOriginal,
]
  .flatMap((valor) => String(valor || "").match(/\d{6,}/g) || [])
  .map((valor) => valor.slice(-6));

const fechaUtc = (valor) => {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
};

export const correspondeAConfirmacionDeDebito = ({
  provisional,
  definitivo,
  diasMargen = 3,
} = {}) => {
  if (!esDebitoProvisional(provisional) || esDebitoProvisional(definitivo)) {
    return false;
  }
  if (Number(provisional?.montoBancario) !== Number(definitivo?.montoBancario)) {
    return false;
  }

  const fechaProvisional = fechaUtc(provisional?.fechaBanco);
  const fechaDefinitiva = fechaUtc(definitivo?.fechaBanco);
  if (fechaProvisional === null || fechaDefinitiva === null) return false;
  const margen = diasMargen * 24 * 60 * 60 * 1000;
  if (Math.abs(fechaDefinitiva - fechaProvisional) > margen) return false;

  const codigo = codigoAutorizacionProvisional(provisional);
  if (!codigo) return false;
  return identificadoresDefinitivos(definitivo).includes(codigo);
};
