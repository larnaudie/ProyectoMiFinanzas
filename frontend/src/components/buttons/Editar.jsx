const BotonEditar = ({ onClick, children = "Editar" }) => (
  <button type="button" onClick={onClick}>{children}</button>
);

export default BotonEditar;
