## K8s Task Scheduler

### Installation & development

#### Build docker image

To build docker image set *version* in *package.json* file and call *build.sh* script. Image will be tagged with *version*.  
If *dependencies* in *package.json* was modified, rebuild *package-lock.json* by calling *build-package-lock.sh* script before image build.

#### Tests

To run unit tests call *tests/run-unit-tests.sh* script.

To run Fitnesse tests perform the following steps:

* Build docker image by calling *build.sh* script.
* Call *tests/init-minikube.sh* script to install and run Minikube.
* Call *tests/create-pod.sh* script to create pod with *k8s-tasks-scheduler* service and Fitnesse.
* Go to http://localhost:8081/SchedulerTestSuite from the host or http://your_host:8081/SchedulerTestSuite from network and click "Suite" button.

After creating the pod *k8s-tasks-scheduler* service will be available on http://localhost:8086/api/jobs (or http://your_host:8086/api/jobs from network).  
Swagger documentation will be available on http://localhost:8086/docs (or http://your_host:8086/docs from network).

To run *k8s-tasks-scheduler* service with sources mounted from file system, call *tests/create-pod.sh* with "*dev*" as first parameter: *tests/create-pod.sh dev*.

#### Environment

* HOST - host to listen, default: "0.0.0.0"
* PORT - port to listen, default: "8086"
* NAMESPACE - k8s namespace to create cronjobs, default: "default"
* EXECUTOR_IMAGE - docker image to execute, default: "busybox"
* K8S\_API_VERSION - k8s api version, default: "1.8", available values are: "1.7", "1.8", "1.9"
* K8S\_BATCH_API - k8s batch api, default: "v1beta1"

### REST API

#### Create new job

##### Request
```
POST /api/jobs
Content-Type: application/json

{
  "name": "name-of-job",
  "type": "k8s",
  "labels": {
    "app": "scheduler",
    "product": "custom"
  },
  "request": {
    "uri": "http://host.net/page",
    "method": "POST",
    "body": { "data": "value" }
  },
  "recur": {
    start: "2018-06-01T15:00:00.000Z",
    triggers: [ "0 12-24/1 * * *" ],
    end: "2018-06-02T14:59:59.000Z"
  },
  "executor": {
    "image": "busybox",
    "args": [ "echo", "Hello" ]
  }
}
```

##### Response
```
Content-Type: application/json
```
Messages:
```
Status code  body

201          { code: 201, message: "Job created." }
400          { code: 400, message: "Invalid request body." }
409          { code: 409, message: "Job with the same name already exists." }
```

##### Parameters

* *name* - job name, required
* *type* - type of job, optional
* *labels* - object of key-value pairs used to search and delete subsets of jobs, optional
* *request* - http request, optional
  - *uri* - fully qualified uri
  - *method* - http method
  - *body* - request body
* *recur* - description of how to schedule the task, required:
  - *start* - date from which to begin scheduling job, optional
  - *triggers* - array of cron-format expressions which describe how job must be scheduled, required
  - *end* - date when a job must be deleted, optional
* *executor* - cronjob executor description, optional
  - *image* - docker image to execute, default "busybox"
  - *args* - parameters passed to executor image


#### Modify existing or create new job

##### Request
```
PUT /api/jobs/jobname
Content-Type: application/json

{
  "type": "k8s",
  "labels": {
    "app": "scheduler",
    "product": "custom"
  },
  "request": {
    "uri": "http://host.net/page",
    "method": "POST",
    "body": { "data": "value" }
  },
  "recur": {
    start: "2018-06-01T15:00:00.000Z",
    triggers: [ "0 12-24/1 * * *" ],
    end: "2018-06-02T14:59:59.000Z"
  },
  "executor": {
    "image": "busybox",
    "args": [ "echo", "Hello" ]
  }
}
```

##### Response
```
Content-Type: application/json
```
Messages:
```
Status code  body

200          { code: 200, message: "Job updated." }
201          { code: 201, message: "Job created." }
400          { code: 400, message: "Invalid request body." }
```

##### Parameters

* *jobname* - name of job to create or update, required


#### Get job by name

##### Request
```
GET /api/jobs/jobname
```

##### Response
```
Content-Type: application/json
```
Status code: 200, body:
```
{
  "name": "name-of-job",
  "type": "k8s",
  "labels": {
    "app": "scheduler",
    "product": "custom"
  },
  "request": {
    "uri": "http://host.net/page",
    "method": "POST",
    "body": { "data": "value" }
  },
  "recur": {
    start: "2018-06-01T15:00:00.000Z",
    triggers: [ "0 12-24/1 * * *" ],
    end: "2018-06-02T14:59:59.000Z"
  },
  "executor": {
    "image": "busybox",
    "args": [ "echo", "Hello" ]
  },
  active: false,
  lastSchedule: "2018-06-01T19:00:00.000Z"
}
```
Status code: 404, body:
```
{ code: 404, message: "Job not found." }

```

##### Parameters

* *jobname* - name of job to get, required
* *active* - is job now active, boolean
* *lastSchedule* - timestamp of last start


#### Get jobs list

##### Request
```
GET /api/jobs?<query>
```

##### Response
```
Content-Type: application/json

[
  {
    "name": "name-of-job",
    "type": "k8s",
    "labels": {
      "app": "scheduler",
      "product": "custom"
    },
    "request": {
      "uri": "http://host.net/page",
      "method": "POST",
      "body": { "data": "value" }
    },
    "recur": {
      start: "2018-06-01T15:00:00.000Z",
      triggers: [ "0 12-24/1 * * *" ],
      end: "2018-06-02T14:59:59.000Z"
    },
    "executor": {
      "image": "busybox",
      "args": [ "echo", "Hello" ]
    },
    active: false,
    lastSchedule: "2018-06-01T19:00:00.000Z"
  },
  {
    ...
  }
]
```
##### Parameters

* *query* - url query string to search jobs by labels, example: "app=scheduler&product=custom", optional, all jobs will be returned if empty


#### Delete job

##### Request
```
DELETE /api/jobs/jobname
```

##### Response
```
Content-Type: application/json
```
Messages:
```
Status code  body

200          { code: 200, message: "Job deleted." }
404          { code: 404, message: "Job not found." }
```

##### Parameters

* *jobname* - name of job to delete, required


#### Delete all jobs

##### Request
```
DELETE /api/jobs?<query>
```

##### Response
```
Content-Type: application/json
```
Messages:
```
Status code  body

200          { code: 200, message: "All jobs deleted." }
```

##### Parameters

* *query* - url query string to delete jobs by labels, example: "app=scheduler&product=custom", optional, all jobs will be deleted if empty
