import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../services/api.js';

function ImportExcelPage() {
  const { cuentaId } = useParams();
  const [file, setFile] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const importar = async (event) => {
    event.preventDefault();

    if (!file) {
      setError('Selecciona un archivo Excel');
      return;
    }

    const formData = new FormData();
    formData.append('excel', file);

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post(`/importaciones/cuentas/${cuentaId}/excel`, formData);
      setResultado(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'No se pudo importar el Excel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Importar Excel</h1>
          <p>Los movimientos quedan pendientes hasta que los revises.</p>
        </div>
      </header>
      <form className="upload-panel" onSubmit={importar}>
        <input type="file" accept=".xls,.xlsx" onChange={(event) => setFile(event.target.files[0])} />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Importando...' : 'Importar'}</button>
      </form>
      {resultado && (
        <div className="table-shell">
          <h2>Vista previa</h2>
          <p>{resultado.totalProcesados} movimientos procesados</p>
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Detalle</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {resultado.movimientos?.map((item) => (
                <tr key={item.movimiento._id}>
                  <td>{item.estado}</td>
                  <td>{new Date(item.movimiento.fechaBanco).toLocaleDateString()}</td>
                  <td>{item.movimiento.detalleOriginal}</td>
                  <td>{item.movimiento.montoBancario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ImportExcelPage;
