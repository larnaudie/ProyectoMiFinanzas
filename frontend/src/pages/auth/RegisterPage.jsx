import React from "react";
import Register from "../../components/formularios/Register";

const RegisterPage = () => {
  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <div className="register-brand" aria-label="MiFinanzas Control Personal">
          <span className="register-brand-mark" aria-hidden="true">
            $
          </span>
          <div className="register-brand-copy">
            <strong>MiFinanzas</strong>
            <span>Control personal</span>
          </div>
        </div>

        <header className="register-header">
          <span className="register-eyebrow">Empezá a organizarte</span>
          <h1 id="register-title">Crear cuenta</h1>
          <p>Completá tus datos para registrarte y administrar tus finanzas.</p>
        </header>

        <Register />
      </section>
    </main>
  );
};

export default RegisterPage;
