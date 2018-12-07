//
// Models
//
module.exports = {

  swagger: "2.0",
  basePath: "/api",
  info: {

    description: "Kubernetes tasks scheduler",
    version: "1.0.7",
    title: "k8s-tasks-scheduler"
  },
  schemes: [
    "http"
  ],
  paths: {
    "/jobs/{jobId}": {
      get: {
        summary: "Get job by ID",
        description: "Returns single job",
        produces: [ "application/json" ],
        handler: "getJob",
        parameters: [
          {
            in: "query",
            name: "jobId",
            description: "Id of job to fetch",
            required: true,
            type: "string"
          }
        ],
        responses: {
          "200": {
            schema: {
              $ref: "#/definitions/JobResponse"
            }
          },
          "404": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          }
        }
      },
      put: {
        summary: "Update existing or create a new job",
        description: "Updates or creates job",
        produces: [ "application/json" ],
        handler: "updateJob",
        parameters: [
          {
            in: "query",
            name: "jobId",
            description: "Id of job to update or create",
            required: true,
            type: "string"
          },
          {
            in: "body",
            name: "body",
            description: "Job data",
            required: true,
            schema: {
              $ref: "#/definitions/Job"
            }
          }
        ],
        responses: {
          "200": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          },
          "201": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          },
          "400": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          }
        }
      },
      delete: {
        summary: "Delete a job by ID",
        description: "Deletes specified job",
        produces: [ "application/json" ],
        handler: "deleteJob",
        parameters: [
          {
            in: "query",
            name: "jobId",
            description: "Id of job to delete",
            required: true,
            type: "string"
          }
        ],
        responses: {
          "200": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          },
          "404": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          }
        }
      }
    },
    "/jobs": {
      get: {
        summary: "Get list of all jobs",
        description: "Returns list of jobs",
        produces: [ "application/json" ],
        handler: "getAllJobs",
        parameters: [],
        responses: {
          "200": {
            schema: {
              type: "array",
              items: {
                $ref: "#/definitions/JobResponse"
              }
            }
          },
          "500": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          }
        }
      },
      post: {
        summary: "Add a new job",
        description: "Adds new job",
        produces: [ "application/json" ],
        handler: "addJob",
        parameters: [
          {
            in: "body",
            name: "body",
            description: "Job data",
            required: true,
            schema: {
              $ref: "#/definitions/Job"
            }
          }
        ],
        responses: {
          "201": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          },
          "400": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          },
          "409": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          }
        }
      },
      delete: {
        summary: "Delete all jobs",
        description: "Deletes all jobs",
        produces: [ "application/json" ],
        handler: "deleteAllJobs",
        parameters: [],
        responses: {
          "200": {
            schema: {
              $ref: "#/definitions/MessageResponse"
            }
          }
        }
      }
    }
  },
  definitions: {

    recurrence: {

      type: "object",
      required: [ "triggers" ],
      properties: {

        start: { type: "string", default: null },
        triggers: { type: "array", items: { type: "string" } },
        end: { type: "string", default: null }
      },
    },
    request_body: {

      type: "object",
      additionalProperties: true
    },
    request: {

      type: "object",
      required: [ "uri" ],
      properties: {

        uri: { type: "string" },
        method: {

          type: "string",
          enum: [ "GET", "POST", "PUT", "DELETE", "PATCH" ],
          default: "POST"
        },
        body: { $ref: "#/definitions/request_body", default: {} }
      }
    },
    executor: {

      type: "object",
      properties: {

        image: { type: "string", default: null },
        args: { type: "array", items: { type: "string" } }
      }
    },
    labels: {

      id: "labels",
      type: "object",
      additionalProperties: { type: "string" }
    },
    Job: {

      type: "object",
      required: [ "name", "recur" ],
      properties: {

        name: { type: "string" },
        type: { type: "string" },
        labels: { $ref: "#/definitions/labels" },
        request: { $ref: "#/definitions/request" },
        recur: { $ref: "#/definitions/recurrence" },
        executor: { $ref: "#/definitions/executor" }
      }
    },
    JobResponse: {

      type: "object",
      required: [ "name", "recur" ],
      properties: {

        name: { type: "string" },
        type: { type: "string" },
        labels: { $ref: "#/definitions/labels" },
        request: { $ref: "#/definitions/request" },
        recur: { $ref: "#/definitions/recurrence" },
        executor: { $ref: "#/definitions/executor" },
        active: { type: "boolean" },
        lastSchedule: { type: "string" }
      }
    },
    MessageResponse: {

      type: "object",
      required: [ "message" ],
      properties: {

        message: { type: "string" }
      }
    }
  }
};
