import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { guardarGastos } from "../../../features/slices/gastosSlice";
import { guardarCuentas } from "../../../features/slices/cuentasSlice";
import { formatearFecha } from "../../../../utils/utils";

function DesglocePage() {
  const { cuentaId } = useParams();
  const gastos = useSelector((state) => state.gastos.gastos);
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId);
  const dispatch = useDispatch();

  useEffect(() => {
    api
      .get("/gastos")
      .then((response) => {
        dispatch(guardarGastos(response.data.gastos));
      })
      .catch((error) => {
        console.error("Error al obtener las gastos:", error);
      });
    /**
       * Si entrás desde Home, seguramente funciona. Pero si recargás directamente en:
        /cuentas/123/gastos
        Redux puede arrancar vacío, entonces cuentaActual va a ser undefined.
        Para resolver eso después, DesglocePage debería cargar las cuentas si todavía no están cargadas:
       */
    if (cuentas.length === 0) {
      api.get("/cuentas").then((response) => {
        dispatch(guardarCuentas(response.data.cuentas));
      });
    }
  }, []);

  return (
    <>
      <section>
        <h3>FIltros</h3>
        <label id="filtroMes">Seleccione el mes: </label>
        <input type="text" value="Seleccione el mes"></input>
      </section>
      <section className="page-section">
        <div>
          <h1>{cuentaActual?.nombreCuenta || ""}</h1>
        </div>
        <br></br>
        <header className="page-header">
          <div>
            <h1>Lista de Gastos</h1>
            {/*Esta lista filtra por defecto en el mes actual en el que estamos*/}
            <p>Lista y edicion de gastos de la cuenta.</p>
          </div>
          <button type="button">Crear gasto</button>
        </header>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Detalle</th>
                <th>Bancario</th>
                <th>%</th>
                <th>Real</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => {
                return (
                  <tr key={g._id}>
                    <td>{formatearFecha(g.fecha)}</td>
                    <td>
                      <Link to={`/cuentas/${cuentaId}/gastos/gasto/${g._id}`}>
                        {g.detalle}
                      </Link>
                    </td>
                    <td>{g.montoBancario}</td>
                    <td>{g.porcentaje}</td>
                    <td>{g.montoReal}</td>
                    <td>{g.estado}</td>
                    <td>Editar | Eliminar</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default DesglocePage;
