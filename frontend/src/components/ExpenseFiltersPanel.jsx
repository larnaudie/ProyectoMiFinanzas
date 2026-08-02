import SearchableCategorySelect from "./SearchableCategorySelect.jsx";
import SearchableSubcategorySelect from "./SearchableSubcategorySelect.jsx";
import { MESES_DEL_ANIO } from "../utils/filtrosGastos.js";
import { MONEDAS_SOPORTADAS } from "../utils/monedas.js";

const obtenerNombreCuenta = (cuenta) => cuenta.nombreCuenta || "Cuenta sin nombre";

function ExpenseFiltersPanel({
  filtros,
  onChange,
  categorias = [],
  subcategorias = [],
  cuentas = [],
  aniosDisponibles = [],
  mostrarCuenta = false,
  mostrarEstado = false,
  mostrarMoneda = false,
  mostrarIncluye = false,
  mostrarMontoReal = true,
  onClear,
  cantidadVisible,
  id,
  className = "",
}) {
  return (
    <section
      id={id}
      className={`filters-panel expense-filters-panel page-scroll-section ${className}`.trim()}
    >
      <header className="expense-filters-heading">
        <div>
          <h3>Filtros</h3>
          {Number.isFinite(cantidadVisible) && (
            <small>{cantidadVisible} movimientos visibles</small>
          )}
        </div>
        {onClear && (
          <button type="button" className="secondary-button" onClick={onClear}>
            Limpiar filtros
          </button>
        )}
      </header>

      {mostrarCuenta && (
        <label>
          Cuenta
          <SearchableSubcategorySelect
            options={cuentas}
            getOptionLabel={obtenerNombreCuenta}
            value={filtros.cuentaId}
            placeholder="Todas las cuentas"
            ariaLabel="Buscar cuenta para filtrar"
            searchPlaceholder="Buscar cuenta por nombre..."
            searchAriaLabel="Buscar cuenta por nombre"
            emptyMessage="No se encontraron cuentas."
            onChange={(cuentaId) => onChange("cuentaId", cuentaId)}
          />
        </label>
      )}

      <label>
        Detalle
        <input
          type="search"
          value={filtros.detalle}
          onChange={(event) => onChange("detalle", event.target.value)}
          placeholder="Buscar detalle"
        />
      </label>

      <label>
        Categoría
        <SearchableCategorySelect
          categorias={categorias}
          value={filtros.categoriaId}
          placeholder="Todas"
          ariaLabel="Buscar categoría para filtrar"
          onChange={(categoriaId) => onChange("categoriaId", categoriaId)}
        />
      </label>

      <label>
        Subcategoría
        <SearchableSubcategorySelect
          subcategorias={subcategorias}
          value={filtros.subcategoriaId}
          placeholder="Todas"
          ariaLabel="Buscar subcategoría para filtrar"
          onChange={(subcategoriaId) => onChange("subcategoriaId", subcategoriaId)}
        />
      </label>

      {mostrarEstado && (
        <label>
          Estado
          <select
            value={filtros.estado}
            onChange={(event) => onChange("estado", event.target.value)}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="creado">Creados</option>
          </select>
        </label>
      )}

      {mostrarMoneda && (
        <label>
          Moneda
          <select
            value={filtros.moneda}
            onChange={(event) => onChange("moneda", event.target.value)}
          >
            <option value="">Todas</option>
            {MONEDAS_SOPORTADAS.map((moneda) => (
              <option key={moneda} value={moneda}>{moneda}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        Fecha
        <select
          value={filtros.fechaModo}
          onChange={(event) => onChange("fechaModo", event.target.value)}
        >
          <option value="">Sin filtro</option>
          <option value="mes">Por mes</option>
          <option value="rango">Por rango</option>
        </select>
      </label>

      {filtros.fechaModo === "mes" && (
        <>
          <label>
            Mes
            <select
              value={filtros.fechaMes}
              onChange={(event) => onChange("fechaMes", event.target.value)}
            >
              <option value="">Todos los meses</option>
              {MESES_DEL_ANIO.map((mes) => (
                <option key={mes.valor} value={mes.valor}>{mes.nombre}</option>
              ))}
            </select>
          </label>

          <label>
            Año
            <select
              value={filtros.fechaAnio}
              onChange={(event) => onChange("fechaAnio", event.target.value)}
            >
              <option value="">Todos los años</option>
              {aniosDisponibles.map((anio) => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {filtros.fechaModo === "rango" && (
        <>
          <label>
            Desde
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(event) => onChange("fechaDesde", event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(event) => onChange("fechaHasta", event.target.value)}
            />
          </label>
        </>
      )}

      <label>
        Monto bancario
        <select
          value={filtros.montoBancarioModo}
          onChange={(event) => onChange("montoBancarioModo", event.target.value)}
        >
          <option value="">Sin filtro</option>
          <option value="monto">Monto exacto</option>
          <option value="rango">Por rango</option>
        </select>
      </label>

      {filtros.montoBancarioModo === "monto" && (
        <label>
          Bancario exacto
          <input
            type="number"
            step="0.01"
            value={filtros.montoBancario}
            onChange={(event) => onChange("montoBancario", event.target.value)}
          />
        </label>
      )}

      {filtros.montoBancarioModo === "rango" && (
        <>
          <label>
            Bancario desde
            <input
              type="number"
              step="0.01"
              value={filtros.montoBancarioDesde}
              onChange={(event) => onChange("montoBancarioDesde", event.target.value)}
            />
          </label>
          <label>
            Bancario hasta
            <input
              type="number"
              step="0.01"
              value={filtros.montoBancarioHasta}
              onChange={(event) => onChange("montoBancarioHasta", event.target.value)}
            />
          </label>
        </>
      )}

      {mostrarMontoReal && (
        <label>
          Monto real
          <select
            value={filtros.montoRealModo}
            onChange={(event) => onChange("montoRealModo", event.target.value)}
          >
            <option value="">Sin filtro</option>
            <option value="monto">Monto exacto</option>
            <option value="rango">Por rango</option>
          </select>
        </label>
      )}

      {mostrarMontoReal && filtros.montoRealModo === "monto" && (
        <label>
          Real exacto
          <input
            type="number"
            step="0.01"
            value={filtros.montoReal}
            onChange={(event) => onChange("montoReal", event.target.value)}
          />
        </label>
      )}

      {mostrarMontoReal && filtros.montoRealModo === "rango" && (
        <>
          <label>
            Real desde
            <input
              type="number"
              step="0.01"
              value={filtros.montoRealDesde}
              onChange={(event) => onChange("montoRealDesde", event.target.value)}
            />
          </label>
          <label>
            Real hasta
            <input
              type="number"
              step="0.01"
              value={filtros.montoRealHasta}
              onChange={(event) => onChange("montoRealHasta", event.target.value)}
            />
          </label>
        </>
      )}

      {mostrarIncluye && (
        <label>
          Incluye en monto real
          <select
            value={filtros.incluirMontoReal}
            onChange={(event) => onChange("incluirMontoReal", event.target.value)}
          >
            <option value="">Todos</option>
            <option value="true">Incluidos</option>
            <option value="false">No incluidos</option>
          </select>
        </label>
      )}
    </section>
  );
}

export default ExpenseFiltersPanel;
