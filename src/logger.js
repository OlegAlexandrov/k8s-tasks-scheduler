//
// Logger
//

const { createLogger, format, transports } = require('winston')

const {
  combine, timestamp, printf, splat, colorize
} = format

const myFormat = printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)

module.exports = createLogger({
  level: 'info',
  format: combine(
    splat(),
    colorize(),
    timestamp(),
    myFormat
  ),
  transports: [new transports.Console()]
})
