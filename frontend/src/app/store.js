import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/slices/authSlice.js';
import cuentasReducer from '../features/slices/cuentasSlice.js';
import bancosReducer from '../features/slices/bancosSlice.js';
import gastosReducer from '../features/slices/gastosSlice.js';
import categoriasReducer from '../features/slices/categoriasSlice.js';
import subcategoriasReducer from '../features/slices/subcategoriasSlice.js';
import tarjetasReducer from '../features/slices/tarjetasSlice.js';
import prestamosReducer from '../features/slices/prestamosSlice.js';

const store = configureStore({
  reducer: {
    auth: authReducer,
    bancos: bancosReducer,
    cuentas: cuentasReducer,
    gastos: gastosReducer,
    categorias: categoriasReducer,
    subcategorias: subcategoriasReducer,
    tarjetas: tarjetasReducer,
    prestamos: prestamosReducer,
  },
});

export default store;
