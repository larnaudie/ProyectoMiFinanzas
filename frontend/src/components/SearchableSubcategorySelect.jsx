import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const obtenerNombreSubcategoria = (subcategoria) =>
  subcategoria.nombreSubcategoria || "";

const obtenerIdOpcion = (opcion) => opcion._id;

function SearchableSubcategorySelect({
  subcategorias = [],
  options,
  getOptionLabel = obtenerNombreSubcategoria,
  getOptionValue = obtenerIdOpcion,
  value,
  onChange,
  className = "table-select",
  disabled = false,
  placeholder = "Sin subcategoría",
  ariaLabel = "Seleccionar subcategoría",
  searchPlaceholder = "Buscar por nombre...",
  searchAriaLabel = "Buscar subcategoría por nombre",
  emptyMessage = "No se encontraron subcategorías.",
}) {
  const menuId = `opciones-${useId().replace(/:/g, "")}`;
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [posicion, setPosicion] = useState({
    top: 0,
    bottom: "auto",
    left: 0,
    width: 260,
    maxHeight: 320,
  });

  const opcionesOrdenadas = useMemo(
    () =>
      [...(options || subcategorias)].sort((a, b) =>
        String(getOptionLabel(a)).localeCompare(
          String(getOptionLabel(b)),
          "es",
          { sensitivity: "base", numeric: true },
        ),
      ),
    [getOptionLabel, options, subcategorias],
  );

  const opcionesVisibles = useMemo(() => {
    const textoBuscado = normalizarTexto(busqueda);
    if (!textoBuscado) return opcionesOrdenadas;

    return opcionesOrdenadas.filter((opcion) =>
      normalizarTexto(getOptionLabel(opcion)).includes(textoBuscado),
    );
  }, [busqueda, getOptionLabel, opcionesOrdenadas]);

  const opcionSeleccionada = opcionesOrdenadas.find(
    (opcion) => String(getOptionValue(opcion)) === String(value || ""),
  );

  const actualizarPosicion = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const margen = 8;
    const ancho = Math.min(
      Math.max(rect.width, 270),
      window.innerWidth - margen * 2,
    );
    const espacioDebajo = window.innerHeight - rect.bottom - margen;
    const espacioArriba = rect.top - margen;
    const abrirHaciaArriba = espacioDebajo < 260 && espacioArriba > espacioDebajo;
    const maxHeight = Math.max(
      180,
      Math.min(360, abrirHaciaArriba ? espacioArriba : espacioDebajo),
    );
    const left = Math.max(
      margen,
      Math.min(rect.left, window.innerWidth - ancho - margen),
    );

    setPosicion({
      top: abrirHaciaArriba ? "auto" : rect.bottom + 4,
      bottom: abrirHaciaArriba
        ? window.innerHeight - rect.top + 4
        : "auto",
      left,
      width: ancho,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;

    actualizarPosicion();
    const enfocarBusqueda = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });

    const cerrarAlHacerClickAfuera = (event) => {
      if (
        !triggerRef.current?.contains(event.target)
        && !menuRef.current?.contains(event.target)
      ) {
        setAbierto(false);
        setBusqueda("");
      }
    };

    window.addEventListener("resize", actualizarPosicion);
    window.addEventListener("scroll", actualizarPosicion, true);
    document.addEventListener("mousedown", cerrarAlHacerClickAfuera);

    return () => {
      window.cancelAnimationFrame(enfocarBusqueda);
      window.removeEventListener("resize", actualizarPosicion);
      window.removeEventListener("scroll", actualizarPosicion, true);
      document.removeEventListener("mousedown", cerrarAlHacerClickAfuera);
    };
  }, [abierto, actualizarPosicion]);

  const alternarMenu = () => {
    if (disabled) return;
    setAbierto((actual) => !actual);
    setBusqueda("");
  };

  const seleccionar = (subcategoriaId) => {
    onChange(subcategoriaId);
    setAbierto(false);
    setBusqueda("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const menu = abierto
    ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="searchable-subcategory-menu"
          role="listbox"
          aria-label={ariaLabel}
          style={posicion}
        >
          <div className="searchable-subcategory-search-wrap">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={busqueda}
              placeholder={searchPlaceholder}
              aria-label={searchAriaLabel}
              onChange={(event) => setBusqueda(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setAbierto(false);
                  setBusqueda("");
                  triggerRef.current?.focus();
                }
              }}
            />
          </div>

          <div
            className="searchable-subcategory-options"
            style={{ maxHeight: Math.max(110, posicion.maxHeight - 66) }}
          >
            {!busqueda && (
              <button
                className={`searchable-subcategory-option${value ? "" : " selected"}`}
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => seleccionar("")}
              >
                <span>{placeholder}</span>
                {!value && <strong aria-hidden="true">✓</strong>}
              </button>
            )}

            {opcionesVisibles.map((opcion) => {
              const opcionId = getOptionValue(opcion);
              const seleccionada =
                String(opcionId) === String(value || "");

              return (
                <button
                  key={opcionId}
                  className={`searchable-subcategory-option${seleccionada ? " selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={seleccionada}
                  onClick={() => seleccionar(opcionId)}
                >
                  <span>{getOptionLabel(opcion)}</span>
                  {seleccionada && <strong aria-hidden="true">✓</strong>}
                </button>
              );
            })}

            {opcionesVisibles.length === 0 && (
              <p className="searchable-subcategory-empty">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="searchable-subcategory">
      <button
        ref={triggerRef}
        className={`${className} searchable-subcategory-trigger`.trim()}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={abierto ? menuId : undefined}
        aria-expanded={abierto}
        onClick={alternarMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !abierto) {
            event.preventDefault();
            alternarMenu();
          }
        }}
      >
        <span>{opcionSeleccionada ? getOptionLabel(opcionSeleccionada) : placeholder}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {menu}
    </div>
  );
}

export default SearchableSubcategorySelect;
