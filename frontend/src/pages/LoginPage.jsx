import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUsuario } from '../features/auth/authSlice.js';

function LoginPage() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ username: '', password: '' });

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(loginUsuario(form));
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>MiFinanzas</h1>
        <label>
          Usuario
          <input name="username" value={form.username} onChange={handleChange} autoComplete="username" />
        </label>
        <label>
          Password
          <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="current-password" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
      </form>
    </main>
  );
}

export default LoginPage;
