import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api.js";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const username = form.username.trim();
    if (username.length < 3) {
      setError("El usuario debe tener al menos 3 caracteres.");
      return;
    }

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/register", {
        username,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      navigate("/", {
        replace: true,
        state: { registerSuccess: "Cuenta creada correctamente. Ya podés ingresar." },
      });
    } catch (requestError) {
      const validationMessage = requestError.response?.data?.error?.[0]?.message;
      setError(
        validationMessage
          || requestError.response?.data?.message
          || "No pudimos crear la cuenta. Intentá nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="register-form" onSubmit={handleSubmit} noValidate>
      <label className="register-field">
        <span>Usuario</span>
        <input
          type="text"
          name="username"
          placeholder="Elegí tu nombre"
          autoComplete="username"
          value={form.username}
          onChange={handleChange}
          minLength={3}
          maxLength={30}
          required
        />
      </label>

      <label className="register-field">
        <span>Contraseña</span>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          minLength={6}
          maxLength={128}
          required
        />
      </label>

      <label className="register-field">
        <span>Repetir contraseña</span>
        <input
          type="password"
          name="confirmPassword"
          placeholder="••••••••"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange}
          minLength={6}
          maxLength={128}
          required
        />
      </label>

      {error && (
        <p className="register-feedback is-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="register-submit" disabled={loading}>
        {loading ? "Creando cuenta..." : "Completar registro"}
      </button>

      <p className="register-login-copy">
        ¿Ya tenés una cuenta? <Link to="/">Volver al inicio</Link>
      </p>
    </form>
  );
};

export default Register;
