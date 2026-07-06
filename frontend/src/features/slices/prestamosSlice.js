import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../services/api.js";

const initialState = {
  prestamos: [],
  prestamoActual: null,
  loading: false,
  error: null,
};

const prestamosSlice = createSlice({
  name: "prestamos",
  initialState,
  reducers: {
    obtenerPrestamos: (state, action) => {
      state.prestamoActual = action.payload;
    },
    guardarPrestamos: (state, action) => {
      state.prestamos = action.payload;
    },
    agregarPrestamo: (state, action) => {
      state.prestamos.push(action.payload);
    },
    actualizarPrestamo: (state, action) => {
      const index = state.prestamos.findIndex(
        (prestamo) => prestamo._id === action.payload._id,
      );
      if (index !== -1) {
        state.prestamos[index] = action.payload;
      }
    },
    eliminarPrestamo: (state, action) => {
      state.prestamos = state.prestamos.filter(
        (prestamo) => prestamo._id !== action.payload,
      );
    },
  },
});

export const { obtenerPrestamos, guardarPrestamos, agregarPrestamo, actualizarPrestamo, eliminarPrestamo } = prestamosSlice.actions;
export default prestamosSlice.reducer;
