var swagger = require("swagger-node-express");
var paramTypes = require("swagger-node-express/lib/paramTypes.js");
var url = require("url");
var _ = require("underscore");
var models = require('./models.js');
var logger = require("./Logger.js");


function validateEnvironment( envs ){
  
  return _.every( envs, function(env){
    if( !process.env[ env ] ){
      console.error( `Require ENV variable ${env}` );
      return false;
    } else {
      console.log( ` - ${env}: ${process.env[ env ]}` );
      return true;
    }
  })
}

if ( !validateEnvironment(['PRODUCT', 'EXECUTOR_IMAGE']) ){
  process.abort();
}

var namespace = process.env['PRODUCT'];
var executor_image = process.env['EXECUTOR_IMAGE'];


function IsRecurValid(recur) {
  return typeof recur !== 'undefined' &&
    Object.prototype.toString.call(recur.triggers) === '[object Array]' &&
    recur.triggers.length > 0 &&
    recur.triggers[0];
}


k8sClient = function () {
  const Client = require('kubernetes-client').Client;
  const config = require('kubernetes-client').config;
  const client = new Client({ config: config.getInCluster(), version: '1.7' });
  return client;
};

jobNameStructure = function (jobName) {
  const uuid = require('node-uuid').v4;
  var _guid = uuid();
  var _tenant = jobName.split('-tasks-')[0].split('dmp-')[1];
  return {
    cronJobName: _tenant.split('-')[0] + "." + _guid,
    taskId: jobName.split('-tasks-')[1],
    tenant: _tenant
  }
}

k8sCronJobTrigger = function(a) {
  return a.split(' ')[0]+' '+a.split(' ')[1]+' '+a.split(' ')[2]+' '+a.split(' ')[3]+' '+a.split(' ')[4];
}

qsJobId = function(jobId) {
  var _jobNameStructure = jobNameStructure(jobId);
  return { qs: { labelSelector: 'taskId=' + _jobNameStructure.taskId + ', tenant=' + _jobNameStructure.tenant } }
}

cronJob = function (_jobNameStructure, job) {
  return  {
    kind: "CronJob", 
    metadata: {
      name: _jobNameStructure.cronJobName,
      finalizers: ['foregroundDeletion'],
      labels: {
        taskId: _jobNameStructure.taskId,
        tenant: _jobNameStructure.tenant
      }
    },    
    spec: {
      schedule: job.recur.triggers[0],
      successfulJobsHistoryLimit: 1,
      failedJobsHistoryLimit: 1,
      jobTemplate: {
        spec: {
          template: {
            spec: {
              containers: [{
                name: "executor",
                image: executor_image,
                args: ["node", "index.js"],
                env: [{
                  name:"JOB", 
                  value: JSON.stringify(job)
                }]
              }],
              restartPolicy: "OnFailure"
            }
          }
        }
      }  
    }
  }
}  


exports.getById = {
  'spec': {
    description : "Get job by ID",  
    path : "/jobs/{jobId}",
    method: "GET",
    summary : "Find job by ID",
    notes : "Returns a job based on ID",
    type : "JobResponse",
    nickname : "getJobById",
    produces : ["application/json"],
    parameters : [paramTypes.path("jobId", "ID of job that needs to be fetched", "string")],
    responseMessages : [
        { "code": 200 },
        swagger.errors.notFound('job')
    ]
  },
  'action': function (req, res) {
    
    k8sClient().apis.batch.v2alpha1.namespaces( namespace ).cronjobs.get( qsJobId(req.params.jobId) )
    .then((jobs) => {
        var items = jobs.body.items;
        if (!_.isEmpty(items) && items.length === 1){
          var _job = items[0];
          logger.info( '[k8sJob] get cronjob %s', JSON.stringify(_job) );
          var jobData = JSON.parse(_job.spec.jobTemplate.spec.template.spec.containers[0].env[0].value);
          res.send({
            name: req.params.jobId,
            tenant: _job.metadata.labels.tenant,
            taskId: _job.metadata.labels.taskId,
            request: jobData.request,
            nextStart: '',
            lastStart: '',
            recur: jobData.recur
          });
        }
        else {
          swagger.errors.notFound('job', res);
        }
    })
    .catch(err => {
        logger.error( '[k8sJob] get cronjob err %s', err );
        swagger.errors.notFound('job', res);
    });
  }
};

exports.addJob = {
  'spec': {
    path : "/jobs",
    notes : "Add a new job",
    summary : "Add a new job",
    method: "POST",
    produces : ["application/json"],
    parameters : [paramTypes.body("body", "Job object that needs to be added", "Job", undefined, true)],
    responseMessages : [
      {
        "code": 201,
        "message": "Job created"
      },
      swagger.errors.invalid('input'), 
      {
        'code': 409,
        'message': 'Job with the same name already exist'
      }],
    nickname : "addJob"
  },  
  'action': function (req, res) {
    if (typeof req.body === 'undefined' || 
      !req.body.name || 
      !IsRecurValid(req.body.recur)) {
      res.status(400).send("Invalid parameters");
    }
    else {
      logger.info("Call createJob %j", req.body);
      if (req.body.recur.start) req.body.recur.start = new Date(req.body.recur.start);
      if (req.body.recur.end) req.body.recur.end = new Date(req.body.recur.end);
      req.body.recur.triggers[0] = k8sCronJobTrigger(req.body.recur.triggers[0]);

      var _jobNameStructure = jobNameStructure(req.body.name);
      var client = k8sClient();
      client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.get( qsJobId(req.body.name) )
      .then((jobs) => {
        var items = jobs.body.items;
        logger.info( '[k8sJob] get cronjob %j', items );
        if (!_.isEmpty(items) && items.length === 1){
          var _job = items[0];
          logger.info( '[k8sJob] get cronjob %s', JSON.stringify(_job) );
          res.status(409).send("Job with the same name already exist");
        }
        else {
          client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.post({ body: cronJob(_jobNameStructure, req.body) })
          .then((job) => {
              logger.info( '[k8sJob1] add cronjob 1 %s', job );
              res.status(201).send({ status: "OK" });
          })
          .catch(err => {
              logger.error( '[k8sJob] add cronjob err %s', err );
              res.status(400).send("Create job is not possible");
          });
        }
      })
      .catch(err => {
          logger.error( '[k8sJob] get cronjob err %s', err );
          swagger.errors.notFound('job', res);
      });      
    }
  }
};

exports.updateOrAddJob = {
  'spec': {
    path : "/jobs/{jobId}",
    notes : "update or create a new job",
    summary : "update or create a new job",
    method: "PUT",
    produces : ["application/json"],
    parameters : [paramTypes.path("jobId", "Id of job that needs to be paused", "string")],
    responseMessages : [{
        'code': 200,
        'message': 'Job updated'
      }, 
      {
        'code': 201,
        'message': 'Job created'
      },
      swagger.errors.invalid('input')
    ],
    nickname : "resumeJob"
  },  
  'action': function (req, res) {
    if (typeof req.body === 'undefined' || 
      !req.params.jobId || 
      !IsRecurValid(req.body.recur)) {
      res.status(400).send("Invalid parameters");
    }
    else {
      logger.info("Call updateJob %j", req.body);
      if (req.body.recur.start) req.body.recur.start = new Date(req.body.recur.start);
      if (req.body.recur.end) req.body.recur.end = new Date(req.body.recur.end);
      req.body.recur.triggers[0] = k8sCronJobTrigger(req.body.recur.triggers[0]);

      var client = k8sClient();
      var _jobNameStructureNew = jobNameStructure(req.body.name);
      client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.get( qsJobId(req.params.jobId) )
      .then((jobs) => {
        var items = jobs.body.items;
        logger.info( '[k8sJob] get cronjob %j', items );
        if (!_.isEmpty(items) && items.length === 1){
          var _job = items[0];
          logger.info( '[k8sJob] get cronjob %s', JSON.stringify(_job) );
          var _jobNameStructure = jobNameStructure(req.body.name);
          _jobNameStructure.cronJobName = _job.metadata.name;
          client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs( _job.metadata.name ).put({ body: cronJob(_jobNameStructure, req.body) })
          .then((job) => {
            logger.info( '[k8sJob1] update cronjob %s', job );
            res.status(200).send({ status: "OK" });
          })
          .catch(err => {
            logger.error( '[k8sJob] update cronjob err %s', err );
            client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.post({ body: cronJob(_jobNameStructureNew, req.body) })
            .then((job) => {
                logger.info( '[k8sJob1] add cronjob %s', job );
                res.status(201).send({ status: "OK" });
            })
            .catch(err => {
                logger.error( '[k8sJob] add cronjob err %s', err );
                res.status(400).send("Create job is not possible");
            });          
          });
        }
        else {
          client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.post({ body: cronJob(_jobNameStructureNew, req.body) })
          .then((job) => {
              logger.info( '[k8sJob1] create new %s', job );
              res.status(201).send({ status: "OK" });
          })
          .catch(err => {
            logger.error( '[k8sJob] create new cronjob err %s', err );
            res.status(400).send("Create job is not possible");
          }); 
        }
      })
      .catch(err => {
        logger.error( '[k8sJob] update cronjob err %s', err );
        client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.post({ body: cronJob(_jobNameStructureNew, req.body) })
        .then((job) => {
            logger.info( '[k8sJob1] add cronjob %s', job );
            res.status(201).send({ status: "OK" });
        })
        .catch(err => {
            logger.error( '[k8sJob] add cronjob err %s', err );
            res.status(400).send("Create job is not possible");
        });          
      });
    }
  }
};

exports.deleteJob = {
  'spec': {
    path : "/jobs/{jobId}",
    notes : "delete a job",
    summary : "delete a job",
    method: "DELETE",
    parameters : [paramTypes.path("jobId", "Id of job that needs to be deleted", "string")],
    responseMessages : [
      {
          "code": 200,
          "message": "Job deleted"
      }],
    nickname : "deleteJob"
  },  
  'action': function (req, res) {
    client = k8sClient();
    client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.get( qsJobId(req.params.jobId) )
    .then((jobs) => {
        var items = jobs.body.items;
        logger.info( '[k8sJob] get cronjob %j', items );
        if (!_.isEmpty(items) && items.length === 1){
          var _job = items[0];
          logger.info( '[k8sJob] get cronjob %s', JSON.stringify(_job) );
          client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs(_job.metadata.name).delete()
          .then((job) => {
            logger.info( '[k8sJob] delete cronjob %s', job );
            res.status(200).send({ status: "OK" });
          })
          .catch(err => {
              logger.error( '[k8sJob] delete cronjob err %s', err );
              swagger.errors.notFound('job', res);
          });          
        }
        else {
          swagger.errors.notFound('job', res);
        }
    })
    .catch(err => {
        logger.error( '[k8sJob] get cronjob err %s', err );
        swagger.errors.notFound('job', res);
    });
  }
};

exports.deleteJobs = {
  'spec': {
    path : "/jobs",
    notes : "delete all jobs",
    summary : "delete all jobs",
    method: "DELETE",
    parameters : [],
    responseMessages : [
        {
            "code": 200,
            "message": "All jobs deleted"
        }],
    nickname : "deleteJobs"
  },  
  'action': function (req, res) {
    client = k8sClient();
    client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.delete()
    .then((jobs) => {
      logger.info( '[k8sJob] delete cronjobs %s', jobs );
      res.status(200).send({ status: "OK" });
    })
    .catch(err => {
        logger.error( '[k8sJob] delete cronjobs err %s', err );
    });
  }
};

exports.getAll = {
  'spec': {
    description : "Get list of jobs",  
    path : "/jobs",
    method: "GET",
    summary : "Fetch all jobs",
    notes : "Get list of jobs",
    type: "array",
    items: {
      $ref: "JobResponse"
    },
    nickname : "getJobs",
    produces : ["application/json"],
    responseMessages : [{ "code": 200 }]
  },
  'action': function (req, res) {
    client = k8sClient();
    client.apis.batch.v2alpha1.namespaces( namespace ).cronjobs.get()
    .then((jobs) => {
      logger.info( '[k8sJob] get all cronjobs %s', jobs );
      var _res = [];
      jobs.body.items.forEach(function(_job) {
        var jobData = JSON.parse(_job.spec.jobTemplate.spec.template.spec.containers[0].env[0].value);
        _res.push(
          {
            name: jobData.name,
            tenant: _job.metadata.labels.tenant,
            taskId: _job.metadata.labels.taskId,
            request: jobData.request,
            nextStart: '',
            lastStart: '',
            recur: jobData.recur
          }
        );
      });
      res.send(JSON.stringify(_res));
    })
    .catch(err => {
        logger.error( '[k8sJob] get all cronjobs err %s', err );
    });
  }
};

// exports.pauseJob = {
    // 'spec': {
        // path : "/jobs/{jobId}/pause",
        // notes : "pause a job",
        // summary : "pause a job",
        // method: "POST",
        // produces : ["application/json"],
        // parameters : [paramTypes.path("jobId", "Id of job that needs to be paused", "string")],
        // responseMessages : [
            // {
                // "code": 200,
                // "message": "Job paused"
            // },
            // swagger.errors.invalid('input'), 
            // swagger.errors.notFound('job')],
        // nickname : "pauseJob"
    // },  
    // 'action': function (req, res) {
        // if (!req.params.jobId) {
            // res.status(400).send("Invalid Id");
        // }
        // var job = scheduler.getJob(req.params.jobId);
        
        // if (job) {
            // job.pause();
            // res.send(JSON.stringify(job));
        // }
        // else swagger.errors.notFound('job', res);
    // }
// };

// exports.resumeJob = {
    // 'spec': {
        // path : "/jobs/{jobId}/resume",
        // notes : "resume a job",
        // summary : "resume a job",
        // method: "POST",
        // produces : ["application/json"],
        // parameters : [paramTypes.path("jobId", "Id of job that needs to be resumed", "string")],
        // responseMessages : [
            // {
                // "code": 200,
                // "message": "Job resumed"
            // },
            // swagger.errors.invalid('input'), 
            // swagger.errors.notFound('job')],
        // nickname : "resumeJob"
    // },  
    // 'action': function (req, res) {
        // if (!req.params.jobId) {
            // res.status(400).send("Invalid Id");
        // }
        // var job = scheduler.getJob(req.params.jobId);
        
        // if (job) {
            // job.resume();
            // res.send(JSON.stringify(job));
        // }
        // else swagger.errors.notFound('job', res);
    // }
// };


