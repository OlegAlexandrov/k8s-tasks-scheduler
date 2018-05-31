//
// Models
//


module.exports.models = {

  recurrence: {

    id: "recurrence",
    required: [ "triggers" ],

    properties: {

      start: { type: "string", defaultValue: null },
      triggers: { type: "array", items: { type: "string" } },
      end: { type: "string", defaultValue: null }
    }
  },

  request_body: {

    id: "request_body",
    type: "object",
    additionalProperties: true
  },

  request: {

    id: "request",
    required: [ "uri" ],

    properties: {

      uri: { type: "string" },

      method: {

        type: "string",
        enum: [ "GET", "POST", "PUT", "DELETE", "PATCH" ],
        defaultValue: "POST"
      },

      body: { $ref: "request_body", defaultValue: {} }
    }
  },

  executor: {

    id: "executor",

    properties: {

      image: { type: "string", defaultValue: null },
      args: { type: "array", items: { type: "string" } }
    }
  },

  labels: {

    id: "labels",
    type: "object",
    additionalProperties: { type: "string" }
  },

  Job: {

    id: "Job",
    required: [ "name", "recur" ],

    properties: {

      name: { type: "string" },
      type: { type: "string" },
      labels: { $ref: "labels" },
      request: { $ref: "request" },
      recur: { $ref: "recurrence" },
      executor: { $ref: "executor" }
    }
  },

  JobResponse: {

    id: "Job",
    required: [ "name", "recur" ],

    properties: {

      name: { type: "string" },
      type: { type: "string" },
      labels: { $ref: "labels" },
      request: { $ref: "request" },
      recur: { $ref: "recurrence" },
      executor: { $ref: "executor" },
      active: { type: "boolean" },
      lastSchedule: { type: "string" }
    }
  }
};
