//
// Models
//


module.exports.models = {

  recurrence: {

    id: "recurrence",
    required: [ "triggers" ],

    properties: {

      start: {

        type: "string",
        defaultValue: null
      },

      triggers: {

        type: "array", 
        items: { type: "string" }
      },

      end: {

        type: "string",
        defaultValue: null
      }
    }
  },

  request_body: {

    id: "request_body",
    type: "object"
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

      body: {

        $ref: "request_body",
        defaultValue: {}
      }
    }
  },

  Job: {

    id: "Job",
    required: [ "name", "recur" ],

    properties: {

      name: { type: "string" },

      type: {

        type: "string",
        defaultValue: "rest"
      },

      request: { $ref: "request" },
      recur: { $ref: "recurrence" }
    }
  },

  JobResponse: {

    id: "Job",
    required: [ "name", "recur" ],

    properties: {

      name: { type: "string" },
      labels: { type: "object", additionalProperties: { type: "string" } },
      request: { $ref: "request" },
      recur: { $ref: "recurrence" },
      active: { type: "boolean" },
      lastSchedule: { type: "string" }
    }
  }
};
