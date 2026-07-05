import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';

const initialState = {
  token: localStorage.getItem('token'),
  usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),
  loading: false,
  error: null,
};

export const loginUsuario = createAsyncThunk(
  'auth/loginUsuario',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', { username, password });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'No se pudo iniciar sesion');
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.usuario = null;
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUsuario.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUsuario.fulfilled, (state, action) => {
        const usuario = {
          id: action.payload.id,
          rol: action.payload.rol,
        };

        state.loading = false;
        state.token = action.payload.token;
        state.usuario = usuario;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('usuario', JSON.stringify(usuario));
      })
      .addCase(loginUsuario.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
