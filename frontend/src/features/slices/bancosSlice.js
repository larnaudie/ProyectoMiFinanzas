import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = {
  bancos: [],
  bancoActual: null,
  loading: false,
  error: null,
};

const bancosSlice = createSlice({
  name: "bancos",
  initialState,
  reducers: {
    obtenerBancos: (state, action) => {
      state.bancoActual = action.payload;
    },
    guardarBancos: (state, action) => {
      state.bancos = action.payload;
    },
    agregarBanco: (state, action) => {
      state.bancos.push(action.payload);
    },
    actualizarBanco: (state, action) => {
      const index = state.bancos.findIndex(
        (banco) => banco._id === action.payload._id,
      );
      if (index !== -1) {
        state.bancos[index] = action.payload;
      }
    },
    eliminarBanco: (state, action) => {
      state.bancos = state.bancos.filter(
        (banco) => banco._id !== action.payload,
      );
    },
  },
});

export const { obtenerBancos, guardarBancos, agregarBanco, actualizarBanco, eliminarBanco } = bancosSlice.actions;
export default bancosSlice.reducer;
