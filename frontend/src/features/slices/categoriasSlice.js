import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../services/api.js";

const initialState = {
  categorias: [],
  categoriaActual: null,
  loading: false,
  error: null,
};

const categoriasSlice = createSlice({
  name: "categorias",
  initialState,
  reducers: {
    obtenerCategorias: (state, action) => {
      state.categoriaActual = action.payload;
    },
    guardarCategorias: (state, action) => {
      state.categorias = action.payload;
    },
    agregarCategoria: (state, action) => {
      state.categorias.push(action.payload);
    },
    actualizarCategoria: (state, action) => {
      const index = state.categorias.findIndex(
        (categoria) => categoria._id === action.payload._id,
      );
      if (index !== -1) {
        state.categorias[index] = action.payload;
      }
    },
    eliminarCategoria: (state, action) => {
      state.categorias = state.categorias.filter(
        (categoria) => categoria._id !== action.payload,
      );
    },
  },
});

export const { obtenerCategorias, guardarCategorias, agregarCategoria, actualizarCategoria, eliminarCategoria } = categoriasSlice.actions;
export default categoriasSlice.reducer;
