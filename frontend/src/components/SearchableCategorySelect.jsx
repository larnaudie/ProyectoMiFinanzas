import SearchableSubcategorySelect from "./SearchableSubcategorySelect.jsx";

const obtenerNombreCategoria = (categoria) => categoria.nombreCategoria || "";

function SearchableCategorySelect({
  categorias,
  ariaLabel = "Seleccionar categoría",
  ...props
}) {
  return (
    <SearchableSubcategorySelect
      {...props}
      options={categorias}
      getOptionLabel={obtenerNombreCategoria}
      ariaLabel={ariaLabel}
      searchPlaceholder="Buscar categoría por nombre..."
      searchAriaLabel="Buscar categoría por nombre"
      emptyMessage="No se encontraron categorías."
    />
  );
}

export default SearchableCategorySelect;
