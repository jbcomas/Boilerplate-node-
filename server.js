import express from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import winston from 'winston';
import expressWinston from 'express-winston';
import compression from 'compression';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/docs/index';
import { getConnectionSequelize, sequelize } from './src/config/database';
import { pool, getMySqlConnection } from './src/config/mysql2';
import indexRouter from './src/routes/index';

// Database connections
getConnectionSequelize(sequelize);
getMySqlConnection(pool);

const app = express();

// Middleware
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb', extended: true }));
app.use(cors({ origin: '*', methods: 'GET, POST, PUT, DELETE, PATCH' }));
app.use(helmet());
app.use(compression());

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Logging setup with Winston
const loggerConsoleCompile = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf((info) => `${info.level}: ${info.message}`)
);

app.use(
  expressWinston.logger({
    transports: [new winston.transports.Console({ format: loggerConsoleCompile })],
    meta: true,
    expressFormat: true,
    colorize: true,
  })
);

// Error handling with Winston
app.use(
  expressWinston.errorLogger({
    transports: [
      new winston.transports.DailyRotateFile({
        filename: './logs/errors-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        maxSize: '20m',
        maxFiles: '14d',
      }),
    ],
  })
);

// File uploads with Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, './public/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

app.use(
  multer({
    storage,
    limits: { fileSize: 1000000 },
    fileFilter: (req, file, cb) => {
      const filetypes = /jpeg|png|jpg|pdf/;
      if (filetypes.test(file.mimetype)) {
        return cb(null, true);
      }
      cb({ message: 'Archivo con extensión inválida!', statusCode: 400 }, false);
    },
  }).array('images', 10)
);

// Basic routing
app.use('/', indexRouter);

// HTTPS Server
const options = {
  key: fs.readFileSync('.cert/server.key'),
  cert: fs.readFileSync('.cert/server.crt'),
};
const server = https.createServer(options, app).listen(process.env.HTTPS_PORT || 443);

export default app;
