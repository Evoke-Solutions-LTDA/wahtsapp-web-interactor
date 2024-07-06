import { createLogger, format, transports, Logger } from 'winston';

// Função para criar o logger com base no nível de log fornecido
const createWinstonLogger = (debug: boolean): Logger => {
  const logger = createLogger({
    level: debug ? 'debug' : 'info',
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
      new transports.File({ filename: 'logs/combined.log' })
    ]
  });

  if (!debug) {
    logger.transports.forEach((t) => {
      if (t instanceof transports.Console) {
        t.silent = true;
      }
    });
  }

  return logger;
};

export default createWinstonLogger;
