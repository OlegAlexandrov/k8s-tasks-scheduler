//
// Rest API service
//


const express = require( "express" );
const bodyParser = require( "body-parser" );
const winston = require( "winston" );
const expressWinston = require( "express-winston" );
const swaggerNode = require( "swagger-node-express" );
const path = require( "path" );
const fs = require( "fs" );

const models = require( "./models.js" );
const api = require( "./rest-api.js" );
const logger = require( "./logger.js" );


const api_version = "1.0.0";
const api_path = "/api";
const docs_path = "/docs";
const api_docs_path = "/api-docs";
const swagger_ui_path = path.join( path.dirname( require.resolve( "swagger-node-express" ) ), "swagger-ui" );


module.exports.run = function( host, port ) {

  port = port || 8086;
  host = host || "0.0.0.0"

  const app = express();
  const docs_handler = express();

  app.use( bodyParser.json() );
  app.use( bodyParser.urlencoded( { extended: true } ) );
  app.use( expressWinston.logger( { transports: [ new winston.transports.Console( { json: true, colorize: true, level: "warn" } ) ] } ) );
  app.use( api_path, docs_handler );

  const swagger = swaggerNode.createNew( docs_handler );

  swagger.addModels( models )

    .addGet( api.getJob )
    .addGet( api.getAllJobs )
    .addPost( api.addJob )
    .addPut( api.updateJob )
    .addDelete( api.deleteJob )
    .addDelete( api.deleteAllJobs );

  swagger.configureSwaggerPaths( "", api_docs_path, "" );
  swagger.configure( "http://" + host + ":" + port + api_path, api_version );

  app.get( ( new RegExp( "^\\" + docs_path + "(\/.*)?$" ) ), function( req, res, next ) {

    if ( req.url === docs_path + "/" ) {

      fs.readFile( path.join( __dirname, "index.html" ), function( err, html ) {

        res.set( "Content-Type", "text/html" );
        res.set( "Access-Control-Allow-Origin", "*" );

        return res.send( html );
      });

      return;
    }

    next();
  });

  app.use( docs_path, express.static( swagger_ui_path ) );

  app.listen( port, host );
  logger.info( "Service listening at http://%s:%s", host, port );
}
