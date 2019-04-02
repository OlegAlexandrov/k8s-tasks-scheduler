//
// Rest API service
//


const express = require( "express" );
const bodyParser = require( "body-parser" );
const winston = require( "winston" );
const expressWinston = require( "express-winston" );
const swaggerUI = require( "swagger-ui-express" )
const path = require( "path" );
const fs = require( "fs" );

const models = require( "./models.js" );
const api = require( "./rest-api.js" );
const logger = require( "./logger.js" );


const api_version = "1.0.0";
const docs_path = "/docs";


module.exports.run = function( host, port ) {

  port = port || 8086;
  host = host || "0.0.0.0"

  const app = express();

  app.use( bodyParser.json() );
  app.use( bodyParser.urlencoded( { extended: true } ) );
  app.use( expressWinston.logger( { transports: [ new winston.transports.Console( { json: true, colorize: true, level: "warn" } ) ] } ) );

  app.use( docs_path, swaggerUI.serve, swaggerUI.setup( models ) );
  Object.entries( models.paths ).forEach( ( [ path, methods ] ) => {

    Object.entries( methods ).forEach( ( [ method, description ] ) => {

      let expressPath = `${ models.basePath }${ path.replace( /{(\w+)}/g, ":$1" ) }`;
      app[ method ]( expressPath, api[ description.handler ] );
    });
  });

  app.listen( port, host );
  logger.info( "Service listening at http://%s:%s", host, port );
}
