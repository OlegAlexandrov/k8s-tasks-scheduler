var winston = require("winston");
winston.handleExceptions(new winston.transports.Console());
module.exports = winston;
