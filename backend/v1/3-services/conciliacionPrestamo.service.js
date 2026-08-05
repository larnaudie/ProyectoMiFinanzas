import Gasto from "../0.1-models/gasto.model.js";
import Prestamo from "../0.1-models/prestamo.model.js";
import { gastoCoincideConPrestamo } from "../utils/prestamos.js";
import { obtenerMonedaMovimiento } from "../utils/monedas.js";

const idsIguales = (a, b) => String(a?._id || a || "") === String(b?._id || b || "");

const construirConsultaCandidatos = (prestamo) => {
  const consulta = {
    usuarioId: prestamo.usuarioId,
    estado: "creado",
    $or: [
      { prestamoId: null },
      { prestamoId: prestamo._id },
      { prestamoId: { $exists: false } },
    ],
  };
  const regla = prestamo.reglaDeteccion || {};
  if (regla.cuentaId) consulta.cuentaId = regla.cuentaId;
  if (regla.subcategoriaId) consulta.subcategoriaId = regla.subcategoriaId;
  if (regla.desde) consulta.fecha = { $gte: regla.desde };
  return consulta;
};

export const reconciliarPrestamo = async (prestamo) => {
  if (
    !prestamo
    || prestamo.estado !== "activo"
    || prestamo.reglaDeteccion?.activa === false
  ) {
    return prestamo;
  }

  const candidatos = await Gasto.find(construirConsultaCandidatos(prestamo))
    .populate("cuentaId", "moneda tipoCuenta monedas")
    .sort({ fecha: 1, createdAt: 1, _id: 1 });
  const coincidentes = candidatos
    .filter((gasto) => gastoCoincideConPrestamo(gasto, prestamo))
    .slice(0, prestamo.plazoCuotas);

  await Gasto.updateMany(
    {
      usuarioId: prestamo.usuarioId,
      prestamoId: prestamo._id,
      _id: { $nin: coincidentes.map((gasto) => gasto._id) },
    },
    { $set: { prestamoId: null, cuotaPrestamoNumero: null } },
  );

  if (coincidentes.length) {
    await Promise.all(coincidentes.map((gasto, index) => Gasto.updateOne(
      { _id: gasto._id, usuarioId: prestamo.usuarioId },
      {
        $set: {
          prestamoId: prestamo._id,
          cuotaPrestamoNumero: index + 1,
        },
      },
    )));
  }

  prestamo.pagos = coincidentes.map((gasto, index) => ({
    gastoId: gasto._id,
    cuotaNumero: index + 1,
    fecha: gasto.fecha,
    montoDebitado: gasto.montoBancario || gasto.montoReal || 0,
    monedaDebito: obtenerMonedaMovimiento(gasto.cuentaId, gasto.moneda),
    automatico: true,
  }));

  if (prestamo.pagos.length >= prestamo.plazoCuotas) {
    prestamo.estado = "finalizado";
  }
  await prestamo.save();
  return prestamo;
};

export const reconciliarPrestamosUsuario = async (usuarioId) => {
  const prestamos = await Prestamo.find({ usuarioId, estado: "activo" })
    .sort({ createdAt: 1, _id: 1 });

  for (const prestamo of prestamos) {
    await reconciliarPrestamo(prestamo);
  }
  return prestamos;
};

export const reconciliarPrestamosUsuarioSeguro = async (usuarioId) => {
  try {
    await reconciliarPrestamosUsuario(usuarioId);
  } catch (error) {
    console.error("No se pudo conciliar automáticamente los préstamos:", error);
  }
};

export const desvincularGastoPrestamo = async ({ usuarioId, prestamoId, gastoId }) => {
  const prestamo = await Prestamo.findOne({ _id: prestamoId, usuarioId });
  if (!prestamo) {
    const error = new Error("Préstamo no encontrado");
    error.status = 404;
    throw error;
  }

  prestamo.pagos = prestamo.pagos.filter((pago) => !idsIguales(pago.gastoId, gastoId));
  prestamo.reglaDeteccion.activa = false;
  await prestamo.save();
  await Gasto.updateOne(
    { _id: gastoId, usuarioId, prestamoId: prestamo._id },
    { $set: { prestamoId: null, cuotaPrestamoNumero: null } },
  );
  return prestamo;
};
