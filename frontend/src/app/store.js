import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice.js';
import cuentasReducer from '../features/cuentas/cuentasSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cuentas: cuentasReducer,
  },
});
