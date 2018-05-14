var express = require("express");
var bodyParser = require('body-parser');
var _ = require("underscore");

var winston = require("winston");
var expressWinston = require('express-winston');
var swagger = require("swagger-node-express");
var param = swagger.paramTypes;
var path = require('path');
var fs = require('fs');
var logger = require("./Logger.js");
var models = require('./models.js');
var resources = require("./Resources.js");


var api_version = '1.0.0';
var api_path = '/api';
var docs_path = '/docs';
var api_docs_path = '/api-docs';
var swagger_ui_path = path.join(path.dirname(require.resolve("swagger-node-express")), 'swagger-ui');

module.exports.run = function (port, host) {
    port = port || 8086;
    host = host || '0.0.0.0'
    
    module.exports.app = app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    
    //logging
    app.use(expressWinston.logger({
        transports: [
            new winston.transports.Console({
                json: true,
                colorize: true
            })
        ]
    }));
    
    var docs_handler = express();
    app.use(api_path, docs_handler);
    swagger.setAppHandler(docs_handler);
    
    swagger.addModels(models)
    .addGet(resources.getById)
    .addPost(resources.addJob)
    .addPut(resources.updateOrAddJob)
    .addDelete(resources.deleteJob)
    .addDelete(resources.deleteJobs)
    .addGet(resources.getAll);
    
    swagger.configureSwaggerPaths("", api_docs_path, "");
    swagger.configure('http://' + host + ':' + port + '/api', api_version);
    
    app.get((new RegExp('^\\' + docs_path + '(\/.*)?$')), function (req, res, next) {
        if (req.url === docs_path + '/') {
            fs.readFile(path.join(__dirname, 'index.html'), function (err, html) {
                res.set("Content-Type", "text/html");
                res.set("Access-Control-Allow-Origin", "*");
                return res.send(html);
            });
            return;
        }
        next();
    });
    
    app.use(docs_path, express.static(swagger_ui_path));
    
    app.listen(port, host);
    console.info("Service listening at http://%s:%s", host, port);
}
