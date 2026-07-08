import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AppLayout from "./pages/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import HomePage from "./pages/HomePage/HomePage.jsx";
import ManagePage from "./pages/HomePage/ManagePage.jsx";
import DashboardPage from "./pages/HomePage/DashboardPage/DashboardPage.jsx";
import DesglocePage from "./pages/HomePage/DesglocePage/DesglocePage.jsx";
import ImportExcelPage from "./pages/HomePage/DashboardPage/ImportExcelPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import { Provider } from "react-redux";
import store from "./app/store.js";
import DetalleGastoPage from "./pages/HomePage/DesglocePage/DetalleGastoPage.jsx";

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          {/* RUTAS PÚBLICAS */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* RUTAS DE USER */}
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />}></Route>
            <Route path="/manage" element={<ManagePage />}></Route>
            <Route>
              <Route path="/cuentas/:cuentaId/gastos/gasto/:gastoId" element={<DetalleGastoPage />} />
              <Route path="cuentas/:cuentaId/dashboard" element={<DashboardPage />} />
              <Route path="cuentas/:cuentaId/gastos" element={<DesglocePage />} />
              <Route
                path="cuentas/:cuentaId/importar-excel"
                element={<ImportExcelPage />}
              />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
