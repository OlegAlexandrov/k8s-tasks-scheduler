# NodeJs Task Scheduler

## REST API:

### Create new job:

###### Request:
```
POST /api/jobs
Content-Type: application/json
{
	"name": "jobname",
	"type": "rest",
	"request": {
		"uri":"http://localhost:8085/data",
		"method": "POST",
		"json": true,
		"body":{"data":"somedata"}
	},
	"recur": {
		start: "2015-02-02T19:00:00Z",
		triggers: ["0 12-24/1 * * * ?"],
		end: "2015-02-05T19:00:00Z"
	}
}
```

###### Response:
```
HTTP/1.1 201
Content-Type:application/json
{"status":"OK"}
```


Parameters:
- *name*(Required) - Job name
- *type*(Optional) - Type of job.  By default value is "rest"
- *recur*(Required) - Description of how scheduled task:
	- *start*(Optional) - Date from which to begin scheduling job
	- *triggers*(Required) - Array of cron-format expressions which describe how job must be scheduled
	- *end*(Optional) - Date when a job must be deleted  
- For "rest" type:
	- *request*(Required) - Request options(For full information about possible parameters see https://www.npmjs.com/package/request)
		- *uri* - fully qualified uri
		- *method* - http method (default: "GET")
		- *headers* - http headers (default: {})
		- *body* - entity body for PATCH, POST and PUT requests. 


### Modify existing job or create new job:

###### Request:
```
PUT /api/jobs/jobname
Content-Type: application/json
{
	"type": "rest",
	"request": {
		"uri":"http://localhost:8085/data",
		"method": "POST",
		"json": true,
		"body":{"data":"somedata"}
	},
	"recur": {
		start: "2015-02-02T19:00:00Z",
		triggers: ["0 12-24/1 * * * ?"],
		end: "2015-02-05T19:00:00Z"
	}
}
```

###### Response:
```
HTTP/1.1 201 or HTTP/1.1 200 
Content-Type:application/json
{"status":"OK"}
```


### Get job by name:

###### Request:
```
GET /api/jobs/jobname
```

###### Response:
```
HTTP/1.1 200
Content-Type:application/json
{
	"name": "jobname",
	"type": "rest",
	"lastStart": "2015-02-03T12:00:00Z",
	"nextStart": "2015-02-03T13:00:00Z",
	"request": {
		"uri":"http://localhost:8085/data",
		"method": "POST",
		"json": true,
		"body":{"data":"somedata"}
	},
	"recur": {
		start: "2015-02-02T19:00:00Z",
		triggers: ["0 12-24/1 * * * ?"],
		end: "2015-02-05T19:00:00Z"
	}
}
```

### Get job list:

###### Request:
```
GET /api/jobs
```

###### Response:
```
HTTP/1.1 200
Content-Type:application/json
[{
	"name": "jobname",
	"type": "rest",
	"request": {
		"uri":"http://localhost:8085/data",
		"method": "POST",
		"json": true,
		"body":{"data":"somedata"}
	},
	"recur": {
		start: "2015-02-02T19:00:00Z",
		triggers: ["0 12-24/1 * * * ?"],
		end: "2015-02-05T19:00:00Z"
	}
},{
	"name": "jobname",
	"type": "rest",
	"request": {
		"uri":"http://localhost:8085/data",
		"method": "POST",
		"json": true,
		"body":{"data":"somedata"}
	},
	"recur": {
		start: "2015-02-02T19:00:00Z",
		triggers: ["0 12-24/1 * * * ?"],
		end: "2015-02-05T19:00:00Z"
	}
}]
```


### Delete job:

###### Request:
```
DELETE /api/jobs/jobname
```

###### Response:
```
HTTP/1.1 200
Content-Type:application/json
{"status":"OK"}
```
