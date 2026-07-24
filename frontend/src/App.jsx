import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./app/store.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./pages/AppLayout.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import HomePage from "./pages/HomePage/HomePage.jsx";
import ManagePage from "./pages/HomePage/ManagePage.jsx";
import DashboardPage from "./pages/HomePage/DashboardPage/DashboardPage.jsx";
import CuentaImportPage from "./pages/HomePage/DashboardPage/CuentaImportPage.jsx";
import DesglocePage from "./pages/HomePage/DesglocePage/DesglocePage.jsx";
import CuentaGastosPage from "./pages/HomePage/DesglocePage/CuentaGastosPage.jsx";
import DetalleGastoPage from "./pages/HomePage/DesglocePage/DetalleGastoPage.jsx";
import PrestamosPage from "./pages/HomePage/PrestamosPage/PrestamosPage.jsx";
import ProfilePage from "./pages/HomePage/ProfilePage/ProfilePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/manage" element={<ManagePage />} />
              <Route path="/prestamos" element={<PrestamosPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="cuentas/:cuentaId/dashboard" element={<DashboardPage />} />
              <Route path="cuentas/:cuentaId/gastos" element={<CuentaGastosPage />} />
              <Route path="cuentas/:cuentaId/resumenes/:resumenId/gastos" element={<DesglocePage />} />
              <Route path="cuentas/:cuentaId/gastos/gasto/:gastoId" element={<DetalleGastoPage />} />
              <Route path="cuentas/:cuentaId/importar-excel" element={<CuentaImportPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
