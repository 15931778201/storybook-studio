import type { ReadingEventInput } from "@storybook-mvp/shared-types";
import { apiClient } from "./client";

export async function sendReadingEvents(events: ReadingEventInput[]): Promise<void> {
  if (!events.length) {
    return;
  }

  await apiClient.post("/reading/events/batch", {
    events
  });
}
