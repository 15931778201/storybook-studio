import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["bookMeta", "pages"],
  properties: {
    bookMeta: {
      type: "object",
      additionalProperties: false,
      required: ["title", "coverUrl", "ageRange", "tags"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        subtitle: { type: "string", maxLength: 300 },
        coverUrl: { type: "string", minLength: 1 },
        ageRange: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        },
        tags: {
          type: "array",
          items: { type: "string", minLength: 1 }
        }
      }
    },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "pageNo", "elements", "hotspots"],
        properties: {
          id: { type: "string", minLength: 1 },
          pageNo: { type: "integer", minimum: 1 },
          backgroundUrl: { type: "string" },
          narrationAudioUrl: { type: "string" },
          theme: { type: "string" },  // 新增此行
          elements: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "type", "x", "y", "width", "height", "payload"],
              properties: {
                id: { type: "string", minLength: 1 },
                type: { enum: ["text", "image"] },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number", minimum: 0 },
                height: { type: "number", minimum: 0 },
                style: { type: "object", additionalProperties: true },
                payload: { type: "object", additionalProperties: true }
              }
            }
          },
          hotspots: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "x",
                "y",
                "width",
                "height",
                "trigger",
                "actionType",
                "actionPayload"
              ],
              properties: {
                id: { type: "string", minLength: 1 },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number", minimum: 0 },
                height: { type: "number", minimum: 0 },
                trigger: { enum: ["tap"] },
                actionType: { enum: ["play_audio", "jump_page"] },
                actionPayload: { type: "object", additionalProperties: true }
              }
            }
          }
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

export function validateBookImportPayload(payload: unknown): {
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
