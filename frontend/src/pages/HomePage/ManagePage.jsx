import { Link, useParams } from "react-router-dom";
import { api } from "../../services/api";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { guardarBancos } from "../../features/slices/bancosSlice";
import { guardarCuentas } from "../../features/slices/cuentasSlice";
import { guardarGastos } from "../../features/slices/gastosSlice";
import { guardarCategorias } from "../../features/slices/categoriasSlice";
import { guardarSubcategorias } from "../../features/slices/subcategoriasSlice";

function ManagePage() {
  const { cuentaId } = useParams();
  const bancos = useSelector((state) => state.bancos.bancos);
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const gastos = useSelector((state) => state.gastos.gastos);
  const categorias = useSelector((state) => state.categorias.categorias);
  const subcategorias = useSelector(
    (state) => state.subcategorias.subcategorias,
  );
  const tarjetas = useSelector((state) => state.tarjetas.tarjetas);
  const prestamos = useSelector((state) => state.prestamos.prestamos);

  const dispatch = useDispatch();

  useEffect(() => {
    api
      .get("/cuentas")
      .then((response) => {
        dispatch(guardarCuentas(response.data.cuentas));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
    api
      .get("/bancos")
      .then((response) => {
        dispatch(guardarBancos(response.data.bancos));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
    api
      .get("/gastos")
      .then((response) => {
        dispatch(guardarGastos(response.data.gastos));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
    api
      .get("/categorias")
      .then((response) => {
        dispatch(guardarCategorias(response.data.categorias));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
    api
      .get("/subcategorias")
      .then((response) => {
        dispatch(guardarSubcategorias(response.data.subcategorias));
      })
      .catch((error) => {
        console.error("Error al obtener las cuentas:", error);
      });
  }, [dispatch]);

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Manage</h1>
          <p>Gestion Central de Datos.</p>
        </div>
      </header>
      <div className="action-row">
        <h2>Bancos</h2>
        <table>
          <thead>
            <tr>
              <th> Nombre</th>
              <th> Acciones </th>
            </tr>
          </thead>
          <tbody>
            {bancos.map((banco) => (
              <tr key={banco._id}>
                <td>{banco.nombreBanco}</td>
                <td> Editar | Eliminar </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Cuentas</h2>
        <table>
          <thead>
            <tr>
              <th> Nombre</th>
              <th> Acciones </th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((cuenta) => (
              <tr key={cuenta._id}>
                <td>{cuenta.nombreCuenta}</td>
                <td> Editar | Eliminar </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Categorías</h2>
        <table>
          <thead>
            <tr>
              <th> Nombre</th>
              <th> Acciones </th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <tr key={categoria._id}>
                <td>{categoria.nombreCategoria}</td>
                <td> Editar | Eliminar </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Subcategorías</h2>
        <table>
          <thead>
            <tr>
              <th> Nombre</th>
              <th> Acciones </th>
            </tr>
          </thead>
          <tbody>
            {subcategorias.map((subcategoria) => (
              <tr key={subcategoria._id}>
                <td>{subcategoria.nombreSubcategoria}</td>
                <td> Editar | Eliminar </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Tarjetas</h2>
        <table>
          <thead>
            <tr>
              <th> Nombre</th>
              <th> Acciones </th>
            </tr>
          </thead>
          <tbody>
            {tarjetas.map((tarjeta) => (
              <tr key={tarjeta._id}>
                <td>{tarjeta.nombreTarjeta}</td>
                <td> Editar | Eliminar </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Prestamos</h2>
        <table>
          <thead>
            <tr>
              <th> Nombre</th>
              <th> Acciones </th>
            </tr>
          </thead>
          <tbody>
            {prestamos.map((prestamo) => (
              <tr key={prestamo._id}>
                <td>{prestamo.nombre}</td>
                <td> Editar | Eliminar </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ManagePage;
