import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = {
  gastos: [],
  gastoActual: null,
  loading: false,
  error: null,
};

const gastosSlice = createSlice({
  name: "gastos",
  initialState,
  reducers: {
    obtenerGastos: (state, action) => {
      state.gastoActual = action.payload;
    },
    guardarGastos: (state, action) => {
      state.gastos = action.payload;
    },
    agregarGasto: (state, action) => {
      state.gastos.push(action.payload);
    },
    actualizarGasto: (state, action) => {
      const index = state.gastos.findIndex(
        (gasto) => gasto._id === action.payload._id,
      );
      if (index !== -1) {
        state.gastos[index] = action.payload;
      }
    },
    eliminarGasto: (state, action) => {
      state.gastos = state.gastos.filter(
        (gasto) => gasto._id !== action.payload,
      );
    },
  },
});

export const { obtenerGastos, guardarGastos, agregarGasto, actualizarGasto, eliminarGasto } = gastosSlice.actions;
export default gastosSlice.reducer;
