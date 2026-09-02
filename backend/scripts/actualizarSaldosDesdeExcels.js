import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Cuenta from "../v1/0.1-models/cuenta.model.js";
import MovimientoImportado from "../v1/0.1-models/movimientoImportado.model.js";
import SaldoCuenta from "../v1/0.1-models/saldoCuenta.model.js";
import Usuario from "../v1/0.1-models/usuario.model.js";
import {
  normalizarTexto,
  parsearExcelBancario,
} from "../v1/utils/excelParsers.js";
import { normalizarNombreUsuario } from "../v1/utils/usuario.js";
import {
  actualizarSaldoCuentaDesdeExcel,
  crearHashBanco,
} from "../v1/3-services/importacionExcel.service.js";

dotenv.config();

const obtenerArgumento = (nombre) => {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? process.argv[indice + 1] : null;
};

const carpeta = obtenerArgumento("--carpeta");
const nombresUsuarios = String(
  obtenerArgumento("--usuarios") || "Pablo,Test,Test 2",
)
  .split(",")
  .map((nombre) => nombre.trim())
  .filter(Boolean);
const aplicar = process.argv.includes("--aplicar");

if (!carpeta || !fs.existsSync(carpeta)) {
  throw new Error("Indicá una carpeta válida con --carpeta");
}
if (!process.env.MONGO_URI) {
  throw new Error("Falta MONGO_URI");
}

const listarExcels = (directorio) => fs
  .readdirSync(directorio, { withFileTypes: true })
  .flatMap((entrada) => {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) return listarExcels(ruta);
    return /\.(xls|xlsx)$/i.test(entrada.name) ? [ruta] : [];
  });

const clasificarCuentaBanco = (cuentaBanco) => {
  const nombre = normalizarTexto(cuentaBanco);
  if (nombre.includes("cta total univ")) return "corriente";
  if (nombre.includes("ca total convenio")) return "caja";
  return null;
};

const buscarCuentaAplicacion = (cuentas, saldoDetectado) => {
  const tipo = clasificarCuentaBanco(saldoDetectado.cuentaBanco);
  if (!tipo) return null;

  return cuentas.find((cuenta) => {
    const nombre = normalizarTexto(cuenta.nombreCuenta);
    const coincideTipo = tipo === "corriente"
      ? nombre.includes("corriente")
      : nombre.includes("caja") && nombre.includes("ahorro");
    return coincideTipo && cuenta.moneda === saldoDetectado.moneda;
  }) || null;
};

const archivos = listarExcels(path.resolve(carpeta)).sort((a, b) => a.localeCompare(b));
const estadosBancarios = [];
const omitidos = [];

for (const archivo of archivos) {
  try {
    const resultado = parsearExcelBancario(fs.readFileSync(archivo));
    if (!resultado.saldoDetectado) {
      omitidos.push({ archivo: path.relative(carpeta, archivo), motivo: "sin_saldo" });
      continue;
    }
    estadosBancarios.push({
      archivo,
      archivoNombre: path.basename(archivo),
      movimientos: resultado.movimientos,
      saldoDetectado: resultado.saldoDetectado,
    });
  } catch (error) {
    omitidos.push({
      archivo: path.relative(carpeta, archivo),
      motivo: "no_es_estado_bancario_con_saldo",
    });
  }
}

await mongoose.connect(process.env.MONGO_URI);
try {
  const usuarios = await Usuario.find({
    usernameNormalizado: {
      $in: nombresUsuarios.map(normalizarNombreUsuario),
    },
  }).select("username usernameNormalizado");

  const resumen = [];
  for (const usuario of usuarios) {
    const cuentas = await Cuenta.find({ usuarioId: usuario._id });
    const porCuenta = new Map();

    for (const estado of estadosBancarios) {
      const cuenta = buscarCuentaAplicacion(cuentas, estado.saldoDetectado);
      if (!cuenta) {
        resumen.push({
          usuario: usuario.username,
          archivo: estado.archivoNombre,
          estado: "cuenta_no_encontrada",
        });
        continue;
      }

      const clave = String(cuenta._id);
      if (!porCuenta.has(clave)) {
        porCuenta.set(clave, {
          cuenta,
          operaciones: [],
          operacionesSaldos: [],
          saldoMasReciente: null,
          archivos: new Set(),
        });
      }
      const grupo = porCuenta.get(clave);
      grupo.archivos.add(estado.archivoNombre);

      for (const movimiento of estado.movimientos) {
        const detalleNormalizado = normalizarTexto(movimiento.detalleOriginal);
        const hashBanco = crearHashBanco({
          usuarioId: usuario._id,
          cuentaId: cuenta._id,
          referenciaBanco: movimiento.referenciaBanco,
          fechaBanco: movimiento.fechaBanco,
          montoBancario: movimiento.montoBancario,
          montoReal: movimiento.montoReal,
          detalleNormalizado,
        });
        grupo.operaciones.push({
          updateOne: {
            filter: { usuarioId: usuario._id, cuentaId: cuenta._id, hashBanco },
            update: {
              $set: {
                saldoBanco: movimiento.saldoBanco ?? null,
              },
            },
          },
        });
        if (movimiento.saldoBanco !== null && movimiento.saldoBanco !== undefined) {
          grupo.operacionesSaldos.push({
            updateOne: {
              filter: { usuarioId: usuario._id, cuentaId: cuenta._id, hashBanco },
              update: {
                $set: {
                  fecha: movimiento.fechaBanco,
                  monto: movimiento.saldoBanco,
                  moneda: movimiento.moneda,
                  referenciaBanco: movimiento.referenciaBanco || null,
                  detalleOriginal: movimiento.detalleOriginal,
                  filaExcel: movimiento.filaExcel || null,
                  archivoNombre: estado.archivoNombre,
                  cuentaBanco: estado.saldoDetectado.cuentaBanco || null,
                },
                $setOnInsert: {
                  usuarioId: usuario._id,
                  cuentaId: cuenta._id,
                  hashBanco,
                },
              },
              upsert: true,
            },
          });
        }
      }

      const saldoActual = grupo.saldoMasReciente;
      if (
        !saldoActual
        || new Date(estado.saldoDetectado.fecha) > new Date(saldoActual.saldoDetectado.fecha)
      ) {
        grupo.saldoMasReciente = estado;
      }
    }

    for (const grupo of porCuenta.values()) {
      let coincidencias = 0;
      let saldosHistoricosGuardados = 0;
      let saldoCuenta = {
        ...grupo.saldoMasReciente.saldoDetectado,
        actualizado: false,
        saldoActual: grupo.cuenta.saldoActual ?? null,
        motivo: "simulacion",
      };

      if (aplicar) {
        const resultadoBulk = grupo.operaciones.length > 0
          ? await MovimientoImportado.bulkWrite(grupo.operaciones, { ordered: false })
          : { matchedCount: 0 };
        coincidencias = resultadoBulk.matchedCount || 0;
        const resultadoSaldos = grupo.operacionesSaldos.length > 0
          ? await SaldoCuenta.bulkWrite(grupo.operacionesSaldos, { ordered: false })
          : { matchedCount: 0, upsertedCount: 0 };
        saldosHistoricosGuardados =
          (resultadoSaldos.matchedCount || 0)
          + (resultadoSaldos.upsertedCount || 0);
        saldoCuenta = await actualizarSaldoCuentaDesdeExcel({
          cuenta: grupo.cuenta,
          saldoDetectado: grupo.saldoMasReciente.saldoDetectado,
          archivoNombre: grupo.saldoMasReciente.archivoNombre,
        });
      } else {
        coincidencias = await MovimientoImportado.countDocuments({
          usuarioId: usuario._id,
          cuentaId: grupo.cuenta._id,
          hashBanco: {
            $in: grupo.operaciones.map((operacion) => operacion.updateOne.filter.hashBanco),
          },
        });
        saldosHistoricosGuardados = grupo.operacionesSaldos.length;
      }

      resumen.push({
        usuario: usuario.username,
        cuenta: grupo.cuenta.nombreCuenta,
        moneda: grupo.cuenta.moneda,
        archivos: grupo.archivos.size,
        movimientosExcel: grupo.operaciones.length,
        movimientosEncontrados: coincidencias,
        saldosHistoricosGuardados,
        saldo: saldoCuenta,
      });
    }
  }

  console.log(JSON.stringify({
    modo: aplicar ? "aplicado" : "simulacion",
    archivosTotales: archivos.length,
    estadosBancariosConSaldo: estadosBancarios.length,
    archivosOmitidos: omitidos,
    usuariosSolicitados: nombresUsuarios,
    usuariosEncontrados: usuarios.map((usuario) => usuario.username),
    resumen,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
