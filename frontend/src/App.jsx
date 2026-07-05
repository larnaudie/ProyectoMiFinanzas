import { Navigate, Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from './components/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import ImportExcelPage from './pages/ImportExcelPage.jsx';

function App() {
  const token = useSelector((state) => state.auth.token);

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/cuentas" /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/cuentas" element={<AccountsPage />} />
          <Route path="/cuentas/:cuentaId" element={<DashboardPage />} />
          <Route path="/cuentas/:cuentaId/gastos" element={<ExpensesPage />} />
          <Route path="/cuentas/:cuentaId/importar" element={<ImportExcelPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={token ? '/cuentas' : '/login'} />} />
    </Routes>
  );
}

export default App;
