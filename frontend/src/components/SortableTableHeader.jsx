function SortableTableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = "",
}) {
  const active = sortConfig?.key === sortKey;
  const direction = active ? sortConfig.direction : "none";
  const indicator = !active
    ? "↕"
    : sortConfig.direction === "ascending"
      ? "↑"
      : "↓";

  return (
    <th className={className} aria-sort={direction}>
      <button
        className="sortable-table-header"
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Ordenar por ${label}`}
      >
        <span>{label}</span>
        <span className={`sort-indicator${active ? " is-active" : ""}`} aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}

export default SortableTableHeader;
