import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUsuario } from "../../features/slices/authSlice.js";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ username: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (event) => {
    /**
     * aca event.target.name es el valor usuario y el evento.target.value es el valor escrito
     * Si no ponemos ...form, reemplaza todo por lo ultimo editado.
     */
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    //sirve para que no recargue la pagina el Navegador, react maneja el formulario.
    event.preventDefault();

    const resultado = await dispatch(loginUsuario(form));
    //Si el usuario se relleno y machea con el reslutado redireccionar a dashboard
    if (loginUsuario.fulfilled.match(resultado)) {
      // Redirigir a la página de inicio después del inicio de sesión exitoso
      navigate("/home");
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>MiFinanzas</h1>
        <label>
          Usuario
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      <div className="register-link">
        <p>¿No tienes una cuenta?</p>
        <button onClick={() => navigate("/register")}>Registrarse</button>
      </div>
    </main>
  );
}

export default LoginPage;
