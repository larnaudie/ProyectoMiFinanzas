import React from 'react'
import { Link } from 'react-router-dom';


const Register = () => {
  return (
    <>
    <div className="formulario-zona">
  <div className="tarjeta">
    <h2 className="mb-4">Crear cuenta</h2>
    <form>
      <div className="mb-3">
        <label className="form-label">Usuario</label>
        <input
          type="text"
          className="form-control campo"
          placeholder="Elegí tu nombre"
        />
      </div>
      <div className="mb-3">
        <label className="form-label">Email</label>
        <input
          type="email"
          className="form-control campo"
          placeholder="ejemplo@correo.com"
        />
      </div>
      <div className="mb-3">
        <label className="form-label">Contraseña</label>
        <input
          type="password"
          className="form-control campo"
          placeholder="••••••••"
        />
      </div>
      <div className="mb-4">
        <label className="form-label">Repetir Contraseña</label>
        <input
          type="password"
          className="form-control campo"
          placeholder="••••••••"
        />
      </div>
      <button type="button" className="btn btn-principal w-100 mb-3">
        Completar Registro
      </button>
      <Link to="/" className="btn-secundario d-block text-center">
        Volver al inicio
      </Link>
    </form>
  </div>
</div>
    </>
  )
}

export default Register