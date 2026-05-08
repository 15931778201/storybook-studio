import type { Book } from "@storybook-mvp/shared-types";
import { apiClient } from "./client";

export async function fetchPublishedBooks(params?: {
  age?: string;
  tag?: string;
  q?: string;
}): Promise<Book[]> {
  const response = await apiClient.get<{ items: Book[] }>("/books", {
    params
  });
  return response.data.items;
}

export async function fetchBookDetail(id: string): Promise<Book> {
  const response = await apiClient.get<{ item: Book }>(`/books/${id}`);
  return response.data.item;
}
