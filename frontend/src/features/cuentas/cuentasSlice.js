import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';

const initialState = {
  items: [],
  cuentaActual: null,
  loading: false,
  error: null,
};

export const obtenerCuentas = createAsyncThunk(
  'cuentas/obtenerCuentas',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/cuentas');
      return data.cuentas || data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'No se pudieron obtener las cuentas');
    }
  },
);

const cuentasSlice = createSlice({
  name: 'cuentas',
  initialState,
  reducers: {
    seleccionarCuenta(state, action) {
      state.cuentaActual = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(obtenerCuentas.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(obtenerCuentas.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(obtenerCuentas.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { seleccionarCuenta } = cuentasSlice.actions;
export default cuentasSlice.reducer;
