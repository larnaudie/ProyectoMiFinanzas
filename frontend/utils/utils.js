export const formatearFecha = (fecha) => {
  if (!fecha) return "";
  return new Date(fecha).toLocaleDateString("es-UY");
};

export const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  return fecha.slice(0, 10);
};