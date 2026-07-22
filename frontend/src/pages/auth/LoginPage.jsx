import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginStart, loginSuccess, loginError } from "../../features/slices/authSlice.js";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api.js";

function LoginPage() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ username: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    dispatch(loginStart());

    try {
      const response = await api.post("/auth/login", form);
      const usuario = {
        id: response.data.id,
        rol: response.data.rol,
        username: form.username,
      };

      dispatch(
        loginSuccess({
          token: response.data.token,
          ...usuario,
        }),
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("usuario", JSON.stringify(usuario));

      navigate("/home");
    } catch {
      dispatch(loginError("Usuario o password incorrectos"));
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
