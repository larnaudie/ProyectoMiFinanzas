import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

  if (!tiposPermitidos.includes(file.mimetype)) {
    return cb(new Error("Formato de factura no permitido"));
  }

  cb(null, true);
};

export const uploadFactura = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});