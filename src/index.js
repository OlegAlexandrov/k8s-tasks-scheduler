var restService = require("./RestService.js");

process.env['PORT'] = process.env.PORT || 8086;
process.env['HOST'] = process.env.HOST || '0.0.0.0';

restService.run(process.env['PORT'], process.env['HOST']);
