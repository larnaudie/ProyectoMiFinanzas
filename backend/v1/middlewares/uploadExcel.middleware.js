import multer from "multer";

const storage = multer.memoryStorage();

export const uploadExcel = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const permitidos = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!permitidos.includes(file.mimetype)) {
      return cb(new Error("El archivo debe ser Excel"));
    }

    cb(null, true);
  },
});