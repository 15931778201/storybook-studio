import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sessionId", "bookId", "eventType", "clientTs"],
        properties: {
          sessionId: { type: "string", minLength: 1 },
          bookId: { type: "string", minLength: 1 },
          pageNo: { type: "number" },
          eventType: {
            enum: ["open_book", "turn_page", "tap_hotspot", "play_audio", "complete_book"]
          },
          eventPayload: { type: "object", additionalProperties: true },
          clientTs: { type: "string", format: "date-time" }
        }
      }
    }
  }
};

const validate = ajv.compile(schema);

function normalizeError(error: ErrorObject): { path: string; message: string } {
  return {
    path: error.instancePath || "/",
    message: error.message ?? "Invalid value"
  };
}

export function validateReadingEventsPayload(payload: unknown): {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
} {
  const valid = validate(payload);
  if (valid) {
    return {
      valid: true,
      errors: []
    };
  }

  return {
    valid: false,
    errors: (validate.errors ?? []).map(normalizeError)
  };
}
