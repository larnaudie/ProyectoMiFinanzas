import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { api } from "../../services/api";
import {
  actualizarBanco,
  agregarBanco,
  eliminarBanco,
  guardarBancos,
} from "../../features/slices/bancosSlice";
import {
  actualizarCuenta,
  agregarCuenta,
  eliminarCuenta,
  guardarCuentas,
} from "../../features/slices/cuentasSlice";
import {
  actualizarCategoria,
  agregarCategoria,
  eliminarCategoria,
  guardarCategorias,
} from "../../features/slices/categoriasSlice";
import {
  actualizarSubcategoria,
  agregarSubcategoria,
  eliminarSubcategoria,
  guardarSubcategorias,
} from "../../features/slices/subcategoriasSlice";

const obtenerId = (valor) => {
  if (!valor) return "";
  if (typeof valor === "object") return valor._id || valor.id || "";
  return valor;
};

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 20h12a4 4 0 0 0 4-4v-5h-3v5a1 1 0 0 1-1 1H5V6h7V3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="m9 14 1-4 7.7-7.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L15 14l-4 1a1.2 1.2 0 0 1-1.4-1.4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M16.8 2.8 21.2 7a1.4 1.4 0 0 1 0 2l-7.6 7.6a4.7 4.7 0 0 1-3.3 1.4H5.2l-2.4 2.4H20v2.4H2a1 1 0 0 1-.7-1.7l4.9-4.9L2.8 12.8a1.4 1.4 0 0 1 0-2L14.8 2.8a1.4 1.4 0 0 1 2 0Zm-8.9 13h2.4a2.2 2.2 0 0 0 1.6-.7l5.7-5.7-3.1-3.1-8.8 5.8 2.2 3.7Z" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M5 3h10l4 4v5h-2V8h-4V5H7v14h5v2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M18 14a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm1 4h2v2h-2v2h-2v-2h-2v-2h2v-2h2v2Z" />
    </svg>
  );
}

function ManagePage() {
  const dispatch = useDispatch();

  const bancos = useSelector((state) => state.bancos.bancos);
  const cuentas = useSelector((state) => state.cuentas.cuentas);
  const categorias = useSelector((state) => state.categorias.categorias);
  const subcategorias = useSelector((state) => state.subcategorias.subcategorias);
  const prestamos = useSelector((state) => state.prestamos.prestamos);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/bancos").then((response) => dispatch(guardarBancos(response.data.bancos))).catch((error) => console.error("Error al obtener bancos:", error));
    api.get("/cuentas").then((response) => dispatch(guardarCuentas(response.data.cuentas))).catch((error) => console.error("Error al obtener cuentas:", error));
    api.get("/categorias").then((response) => dispatch(guardarCategorias(response.data.categorias))).catch((error) => console.error("Error al obtener categorias:", error));
    api.get("/subcategorias").then((response) => dispatch(guardarSubcategorias(response.data.subcategorias))).catch((error) => console.error("Error al obtener subcategorias:", error));
  }, [dispatch]);

  const cuentasBancarias = cuentas.filter((cuenta) => cuenta.tipoCuenta !== "credito");
  const cuentasCredito = cuentas.filter((cuenta) => cuenta.tipoCuenta === "credito");

  const entidades = {
    bancos: {
      titulo: "Bancos",
      endpoint: "/bancos",
      items: bancos,
      responseKey: "banco",
      nombreKey: "nombreBanco",
      campos: [{ name: "nombreBanco", label: "Nombre del banco", type: "text" }],
      agregar: agregarBanco,
      actualizar: actualizarBanco,
      eliminar: eliminarBanco,
    },
    cuentas: {
      titulo: "Cuentas",
      endpoint: "/cuentas",
      items: cuentasBancarias,
      responseKey: "cuenta",
      nombreKey: "nombreCuenta",
      valoresFijos: { tipoCuenta: "debito" },
      campos: [
        { name: "nombreCuenta", label: "Nombre de la cuenta", type: "text" },
        {
          name: "bancoId",
          label: "Banco",
          type: "select",
          options: bancos,
          optionLabel: "nombreBanco",
          required: false,
        },
        {
          name: "moneda",
          label: "Moneda",
          type: "select",
          defaultValue: "UYU",
          options: [
            { _id: "UYU", nombreCategoria: "UYU" },
            { _id: "USD", nombreCategoria: "USD" },
          ],
        },
      ],
      agregar: agregarCuenta,
      actualizar: actualizarCuenta,
      eliminar: eliminarCuenta,
    },
    categorias: {
      titulo: "Categorias",
      endpoint: "/categorias",
      items: categorias,
      responseKey: "categoria",
      nombreKey: "nombreCategoria",
      campos: [{ name: "nombreCategoria", label: "Nombre de la categoria", type: "text" }],
      agregar: agregarCategoria,
      actualizar: actualizarCategoria,
      eliminar: eliminarCategoria,
    },
    subcategorias: {
      titulo: "Subcategorias",
      endpoint: "/subcategorias",
      items: subcategorias,
      responseKey: "subcategoria",
      nombreKey: "nombreSubcategoria",
      campos: [
        { name: "nombreSubcategoria", label: "Nombre de la subcategoria", type: "text" },
        { name: "categoria", label: "Categoria", type: "select", options: categorias },
      ],
      agregar: agregarSubcategoria,
      actualizar: actualizarSubcategoria,
      eliminar: eliminarSubcategoria,
      extra: (item) => categorias.find((categoria) => categoria._id === obtenerId(item.categoria))?.nombreCategoria || "Sin categoria",
    },
    tarjetas: {
      titulo: "Tarjetas",
      endpoint: "/cuentas",
      items: cuentasCredito,
      responseKey: "cuenta",
      nombreKey: "nombreCuenta",
      valoresFijos: { tipoCuenta: "credito" },
      campos: [
        { name: "nombreCuenta", label: "Nombre de la tarjeta", type: "text" },
        {
          name: "bancoId",
          label: "Banco",
          type: "select",
          options: bancos,
          optionLabel: "nombreBanco",
          required: false,
        },
        {
          name: "moneda",
          label: "Moneda",
          type: "select",
          defaultValue: "UYU",
          options: [
            { _id: "UYU", nombreCategoria: "UYU" },
            { _id: "USD", nombreCategoria: "USD" },
          ],
        },
      ],
      agregar: agregarCuenta,
      actualizar: actualizarCuenta,
      eliminar: eliminarCuenta,
    },
    prestamos: {
      titulo: "Prestamos",
      items: prestamos,
      nombreKey: "nombre",
      disabled: true,
      disabledText: "Pendiente de backend",
    },
  };

  const abrirModal = (tipo, entidadKey, item = null) => {
    const entidad = entidades[entidadKey];
    const valoresIniciales = {};

    entidad.campos?.forEach((campo) => {
      const valorActual = item?.[campo.name];
      valoresIniciales[campo.name] = item
        ? (typeof valorActual === "object" ? obtenerId(valorActual) : valorActual ?? "")
        : campo.defaultValue ?? "";
    });

    setModal({ tipo, entidadKey, item });
    setForm(valoresIniciales);
    setError("");
  };

  const cerrarModal = () => {
    setModal(null);
    setForm({});
    setError("");
  };

  const cambiarCampo = (campo, valor) => {
    setForm({ ...form, [campo]: valor });
  };

  const guardarEntidad = () => {
    const entidad = entidades[modal.entidadKey];
    const camposVacios = entidad.campos.filter(
      (campo) => campo.required !== false && !String(form[campo.name] ?? "").trim(),
    );

    if (camposVacios.length > 0) {
      setError(`Falta completar: ${camposVacios.map((campo) => campo.label).join(", ")}.`);
      return;
    }

    const payload = { ...form, ...entidad.valoresFijos };
    const request = modal.tipo === "crear"
      ? api.post(entidad.endpoint, payload)
      : api.patch(`${entidad.endpoint}/${modal.item._id}`, payload);

    request
      .then((response) => {
        const itemGuardado = response.data[entidad.responseKey];
        dispatch(modal.tipo === "crear" ? entidad.agregar(itemGuardado) : entidad.actualizar(itemGuardado));
        cerrarModal();
      })
      .catch((error) => {
        setError(error.response?.data?.message || error.response?.data?.mensaje || "No se pudo guardar.");
      });
  };

  const eliminarEntidad = (entidadKey, item) => {
    const entidad = entidades[entidadKey];
    const nombre = item[entidad.nombreKey] || "este elemento";
    const confirmar = window.confirm(`Estas seguro de que queres eliminar ${nombre}?`);

    if (!confirmar) return;

    api
      .delete(`${entidad.endpoint}/${item._id}`)
      .then(() => dispatch(entidad.eliminar(item._id)))
      .catch((error) => {
        console.error("Error al eliminar:", error);
        alert("No se pudo eliminar.");
      });
  };

  const renderEntidad = (entidadKey) => {
    const entidad = entidades[entidadKey];

    return (
      <section className="manage-card" key={entidadKey}>
        <header className="manage-card-header">
          <div>
            <h2>{entidad.titulo}</h2>
            <p>{entidad.items.length} registros</p>
          </div>
          <button
            className="manage-icon-button create-icon-button"
            type="button"
            title={`Crear ${entidad.titulo}`}
            aria-label={`Crear ${entidad.titulo}`}
            disabled={entidad.disabled}
            onClick={() => abrirModal("crear", entidadKey)}
          >
            <CreateIcon />
          </button>
        </header>

        {entidad.disabled && <p className="manage-muted">{entidad.disabledText}</p>}

        {!entidad.disabled && entidad.items.length === 0 && (
          <p className="empty-state">No hay registros para mostrar.</p>
        )}

        {!entidad.disabled && entidad.items.length > 0 && (
          <div className="table-shell manage-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  {entidad.extra && <th>Detalle</th>}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entidad.items.map((item) => (
                  <tr key={item._id}>
                    <td>{item[entidad.nombreKey]}</td>
                    {entidad.extra && <td>{entidad.extra(item)}</td>}
                    <td>
                      <div className="manage-actions">
                        <button
                          className="manage-icon-button"
                          type="button"
                          title="Editar"
                          aria-label={`Editar ${item[entidad.nombreKey]}`}
                          onClick={() => abrirModal("editar", entidadKey, item)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="manage-icon-button delete-manage-button"
                          type="button"
                          title="Eliminar"
                          aria-label={`Eliminar ${item[entidad.nombreKey]}`}
                          onClick={() => eliminarEntidad(entidadKey, item)}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  };

  const entidadModal = modal ? entidades[modal.entidadKey] : null;

  return (
    <section className="page-section manage-page">
      <header className="page-header">
        <div>
          <h1>Manage</h1>
          <p>Gestion central de bancos, cuentas, categorias y estructuras futuras.</p>
        </div>
      </header>

      <div className="manage-grid">
        {Object.keys(entidades).map(renderEntidad)}
      </div>

      {modal && entidadModal && (
        <div className="modal-backdrop">
          <section className="modal-panel manage-modal">
            <header className="modal-header">
              <h2>{modal.tipo === "crear" ? "Crear" : "Editar"} {entidadModal.titulo}</h2>
            </header>

            <div className="modal-form">
              {entidadModal.campos.map((campo) => (
                <label key={campo.name}>
                  {campo.label}
                  {campo.type === "select" ? (
                    <select
                      value={form[campo.name] || ""}
                      onChange={(event) => cambiarCampo(campo.name, event.target.value)}
                    >
                      <option value="">Seleccionar</option>
                      {campo.options.map((option) => (
                        <option key={option._id} value={option._id}>
                          {option[campo.optionLabel || "nombreCategoria"]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form[campo.name] || ""}
                      onChange={(event) => cambiarCampo(campo.name, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>

            {error && <p className="inline-error modal-error">{error}</p>}

            <footer className="modal-actions">
              <button type="button" onClick={cerrarModal}>Cancelar</button>
              <button type="button" onClick={guardarEntidad}>Confirmar</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

export default ManagePage;
