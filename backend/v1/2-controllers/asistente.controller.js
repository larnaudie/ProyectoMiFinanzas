import { consultarAsistenteFinancieroService } from "../3-services/asistenteFinanciero.service.js";

export const consultarAsistente = async (req, res, next) => {
  try {
    const resultado = await consultarAsistenteFinancieroService({
      usuarioId: req.user.id,
      pregunta: req.body.pregunta,
      historial: req.body.historial,
    });
    res.status(200).json({
      message: "Consulta financiera respondida",
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};
