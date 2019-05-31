//
// Logger
//

const winston = require('winston')

winston.handleExceptions(new winston.transports.Console({ colorize: true }))
module.exports = winston
