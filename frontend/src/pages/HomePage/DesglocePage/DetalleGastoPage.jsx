import { useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { useDispatch, useSelector } from "react-redux";
//useRef es usado para designar un tiempo.
import { useEffect, useState, useRef } from "react";
import {
  actualizarGasto,
  guardarGastos,
} from "../../../features/slices/gastosSlice";
import { guardarCuentas } from "../../../features/slices/cuentasSlice";
import { formatearFecha } from "../../../../utils/utils";
import { guardarCategorias } from "../../../features/slices/categoriasSlice";
import { guardarSubcategorias } from "../../../features/slices/subcategoriasSlice";

const DetalleGastoPage = () => {
  const { cuentaId, gastoId } = useParams();
  const gastos = useSelector((state) => state.gastos.gastos);
  const gastoActual = gastos.find((gasto) => gasto._id === gastoId);
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const cuentaActual = cuentas.find((cuenta) => cuenta._id === cuentaId);
  const categorias = useSelector((state) => state.categorias.categorias);
  const subcategorias = useSelector(
    (state) => state.subcategorias.subcategorias,
  );
  const dispatch = useDispatch();
  const [form, setForm] = useState({});
  const timerRef = useRef(null);

  useEffect(() => {
    api
      .get("/gastos")
      .then((response) => {
        dispatch(guardarGastos(response.data.gastos));
      })
      .catch((error) => {
        console.error("Error al obtener gastos:", error);
      });
    api
      .get("/cuentas")
      .then((response) => {
        dispatch(guardarCuentas(response.data.cuentas));
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
        console.error("Error al obtener las categorias:", error);
      });
    api
      .get("/subcategorias")
      .then((response) => {
        dispatch(guardarSubcategorias(response.data.subcategorias));
      })
      .catch((error) => {
        console.error("Error al obtener las subcategorias:", error);
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
  }, [dispatch]);

  console.log("form! ", form);
  console.log("categorias! ", categorias);
  console.log("subcategorias! ", subcategorias);

  const handleChange = (campo, valor) => {
    const nuevoForm = {
      ...form,
      [campo]: valor,
    };
    setForm(nuevoForm);
    //aca estamos colocando un tiempo antes de mandar un request patch
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api
        .patch(`/gastos/${gastoActual._id}`, { [campo]: valor })
        .then((res) => {
          //Eso actualiza Redux, pero tu pantalla está leyendo desde form
          dispatch(actualizarGasto(res.data.gasto));
          //asique debemos agregar esto tambien
          setForm(res.data.gasto);
        })
        .catch((err) => console.error(`Error al actualizar gasto: `, err));
    }, 1000);
  };

  useEffect(() => {
    if (gastoActual) {
      setForm(gastoActual);
    }
  }, [gastoActual]);
  return (
    <>
      <form>
        <p>Detalles del Gasto</p>
        <label id="detalleGasto">Detalle: </label>
        <input
          type="text"
          value={form?.detalle || ""}
          //Le paso un valor campo con el nombre definido, y el valor es el valor del evento value.
          onChange={(event) => handleChange("detalle", event.target.value)}
        ></input>

        <label id="fechaGasto">Fecha: </label>
        <input
          type="date"
          value={form.fecha ? form.fecha.slice(0, 10) : ""}
          onChange={(event) => handleChange("fecha", event.target.value)}
        />

        <label id="montoBancario">Monto Bancario: </label>
        <input
          type="text"
          value={form?.montoBancario || ""}
          //hay que colocarle el number y preever que devuelva algo.
          onChange={(event) =>
            handleChange(
              "montoBancario",
              event.target.value === "" ? "" : Number(event.target.value),
            )
          }
        ></input>

        <label id="porcentajeGasto">Porcentaje: </label>
        <input
          type="text"
          value={form?.porcentaje || ""}
          //conviene convertir los numeros
          onChange={(event) =>
            handleChange(
              "porcentaje",
              event.target.value === "" ? "" : Number(event.target.value),
            )
          }
        ></input>
        <label id="porcentajeGasto">
          Monto Real: {form.montoReal === 0 ? 0 : form?.montoReal || ""}{" "}
        </label>

        <label id="incluirEnMonto">¿Incluir en Monto Real? </label>
        <input
          type="checkbox"
          checked={Boolean(form?.incluirMontoReal)}
          onChange={(event) =>
            //para un checkbox, se usa checked no value
            handleChange("incluirMontoReal", event.target.checked)
          }
        ></input>

        <label>Categoria: </label>
        <select
          value={form.categoriaId?._id || form.categoriaId || ""}
          onChange={(event) => handleChange("categoriaId", event.target.value)}
        >
          <option value="">Seleccione categoria</option>

          {categorias.map((categoria) => (
            <option key={categoria._id} value={categoria._id}>
              {categoria.nombreCategoria}
            </option>
          ))}
        </select>

        <label>Subcategoria: </label>
        <select
          value={form.subcategoriaId?._id || form.subcategoriaId || ""}
          onChange={(event) => handleChange("subcategoriaId", event.target.value)}
        >
          <option value="">Seleccione subcategoria</option>

          {subcategorias.map((subcategoria) => (
            <option key={subcategoria._id} value={subcategoria._id}>
              {subcategoria.nombreSubcategoria}
            </option>
          ))}
        </select>
      </form>
    </>
  );
};

export default DetalleGastoPage;

/** Documentacion:
 * 
1) Problema 1: No me dejaba sobreescribir los valores
 Si yo uso gastoActual, y no form:

 <label id="porcentajeGasto">Porcentaje: </label>
        <input
          type="text"
          value={gastoActual?.porcentaje || ""}
          onChange={(event) => handleChange("porcentaje", event.target.value)}
 ></input>

Entonces siempre va a usar lo que viene del gastoActual y no deja sobreescribir
Debemos crear un form y un setForm para usarlo como lugar donde guarda todos los valores del gastoActual
y poder sobreescribirlo

gastoActual = dato original desde Redux/backend
form = copia editable que se muestra en los inputs
Si ponés value={gastoActual.detalle}, el input queda atado al dato original.
Si ponés value={form.detalle}, el input queda atado a lo que estás escribiendo.
        
 */
