import multer from 'multer';

// Armazena arquivos em memória RAM (Buffer) para processamento ágil via SheetJS (xlsx)
const storage = multer.memoryStorage();

// Filtro de tipos permitidos (.xlsx, .xls, .csv)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const originalName = file.originalname.toLowerCase();
  const isValidExt = allowedExtensions.some(ext => originalName.endsWith(ext));
  
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'text/plain',
    'application/octet-stream' // comum em uploads do Windows para csv/xlsx
  ];
  
  if (isValidExt || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo inválido. Apenas planilhas Excel (.xlsx, .xls) e arquivos CSV são aceitos.'), false);
  }
};

export const uploadSpreadsheet = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10MB
  }
});
