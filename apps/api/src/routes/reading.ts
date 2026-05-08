import { Router } from "express";
import { ApiError } from "../utils/apiError";
import { validateReadingEventsPayload } from "../validators/readingEventsValidator";
import { insertReadingEvents } from "../services/readingService";
import type { ReadingEventInput } from "@storybook-mvp/shared-types";

export const readingRouter = Router();

readingRouter.post("/reading/events/batch", async (req, res, next) => {
  try {
    const validation = validateReadingEventsPayload(req.body);
    if (!validation.valid) {
      throw new ApiError(400, "Invalid reading events payload.", validation.errors);
    }

    const inserted = await insertReadingEvents(req.body.events as ReadingEventInput[]);

    res.status(201).json({
      inserted
    });
  } catch (error) {
    next(error);
  }
});
