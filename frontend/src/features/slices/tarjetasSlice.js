import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../services/api.js";

const initialState = {
  tarjetas: [],
  tarjetaActual: null,
  loading: false,
  error: null,
};

const tarjetasSlice = createSlice({
  name: "tarjetas",
  initialState,
  reducers: {
    obtenerTarjetas: (state, action) => {
      state.tarjetaActual = action.payload;
    },
    guardarTarjetas: (state, action) => {
      state.tarjetas = action.payload;
    },
    agregarTarjeta: (state, action) => {
      state.tarjetas.push(action.payload);
    },
    actualizarTarjeta: (state, action) => {
      const index = state.tarjetas.findIndex(
        (tarjeta) => tarjeta._id === action.payload._id,
      );
      if (index !== -1) {
        state.tarjetas[index] = action.payload;
      }
    },
    eliminarTarjeta: (state, action) => {
      state.tarjetas = state.tarjetas.filter(
        (tarjeta) => tarjeta._id !== action.payload,
      );
    },
  },
});

export const { obtenerTarjetas, guardarTarjetas, agregarTarjeta, actualizarTarjeta, eliminarTarjeta } = tarjetasSlice.actions;
export default tarjetasSlice.reducer;
