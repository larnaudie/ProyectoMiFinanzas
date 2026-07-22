import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = {
  cuentas: [],
  cuentaActual: null,
  loading: false,
  error: null,
};

const cuentasSlice = createSlice({
  name: "cuentas",
  initialState,
  reducers: {
    seleccionarCuenta: (state, action) => {
      state.cuentaActual = action.payload;
    },
    obtenerCuentas: (state, action) => {
      state.cuentas = action.payload;
    },
    guardarCuentas: (state, action) => {
      state.cuentas = action.payload;
    },
    agregarCuenta: (state, action) => {
      state.cuentas.push(action.payload);
    },
    actualizarCuenta: (state, action) => {
      const index = state.cuentas.findIndex(
        (cuenta) => cuenta._id === action.payload._id,
      );
      if (index !== -1) {
        state.cuentas[index] = action.payload;
      }
    },
    eliminarCuenta: (state, action) => {
      state.cuentas = state.cuentas.filter(
        (cuenta) => cuenta._id !== action.payload,
      );
    },
  },
});

export const { seleccionarCuenta, obtenerCuentas, guardarCuentas, agregarCuenta, actualizarCuenta, eliminarCuenta } = cuentasSlice.actions;
export default cuentasSlice.reducer;
