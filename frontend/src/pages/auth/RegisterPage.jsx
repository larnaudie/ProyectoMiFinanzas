import React from "react";
import Register from "../../components/formularios/Register";

const RegisterPage = () => {
  return (
    <>
      <div className="fondo-completo" />
      <main className="contenedor-flex">
        <div className="banner">
          <p>Completá tus datos para registrarte.</p>
        </div>
        <Register />
      </main>
    </>
  );
};

export default RegisterPage;
