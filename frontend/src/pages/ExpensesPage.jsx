function ExpensesPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Gastos</h1>
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
            <tr>
              <td colSpan="6">Todavia no cargamos la lista en pantalla.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ExpensesPage;
