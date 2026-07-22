import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = {
  subcategorias: [],
  subcategoriaActual: null,
  loading: false,
  error: null,
};

const subcategoriasSlice = createSlice({
  name: "subcategorias",
  initialState,
  reducers: {
    obtenerSubcategorias: (state, action) => {
      state.subcategoriaActual = action.payload;
    },
    guardarSubcategorias: (state, action) => {
      state.subcategorias = action.payload;
    },
    agregarSubcategoria: (state, action) => {
      state.subcategorias.push(action.payload);
    },
    actualizarSubcategoria: (state, action) => {
      const index = state.subcategorias.findIndex(
        (subcategoria) => subcategoria._id === action.payload._id,
      );
      if (index !== -1) {
        state.subcategorias[index] = action.payload;
      }
    },
    eliminarSubcategoria: (state, action) => {
      state.subcategorias = state.subcategorias.filter(
        (subcategoria) => subcategoria._id !== action.payload,
      );
    },
  },
});

export const { obtenerSubcategorias, guardarSubcategorias, agregarSubcategoria, actualizarSubcategoria, eliminarSubcategoria } = subcategoriasSlice.actions;
export default subcategoriasSlice.reducer;
