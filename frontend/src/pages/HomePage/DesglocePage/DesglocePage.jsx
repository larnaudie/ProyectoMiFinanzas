import { Link, useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { guardarGastos } from "../../../features/slices/gastosSlice";

function DesglocePage() {
  const { cuentaId } = useParams();
  const gastos = useSelector((state) => state.gastos.gastos);

  const dispatch = useDispatch();

  useEffect(() => {
    api
      .get("/gastos")
      .then((response) => {
        dispatch(guardarGastos(response.data.gastos));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
  },[]);

  console.log('gastos; ', gastos)
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Lista de Gastos</h1>
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
            </tr>
          </thead>
          <tbody>
            {gastos.map((g)=>{
              return <tr>
                <td>{g.fecha}</td>
                <td>{g.detalle}</td>
                <td>{g.montoBancario}</td>
                <td>{g.porcentaje}</td>
                <td>{g.montoReal}</td>
                <td>{g.estado}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default DesglocePage;
