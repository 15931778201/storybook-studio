import type { AdminLoginResponse, Book } from "@storybook-mvp/shared-types";
import { apiClient } from "./client";

export async function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  const response = await apiClient.post<AdminLoginResponse>("/admin/login", {
    username,
    password
  });
  return response.data;
}

export async function importBook(payload: unknown): Promise<Book> {
  const response = await apiClient.post<{ item: Book }>("/admin/books/import", payload);
  return response.data.item;
}

export async function fetchAdminBooks(): Promise<Book[]> {
  const response = await apiClient.get<{ items: Book[] }>("/admin/books");
  return response.data.items;
}

export async function fetchAdminBookDetail(bookId: string): Promise<Book> {
  const response = await apiClient.get<{ item: Book }>(`/admin/books/${bookId}`);
  return response.data.item;
}

export async function updateAdminBook(bookId: string, payload: unknown): Promise<Book> {
  const response = await apiClient.patch<{ item: Book }>(`/admin/books/${bookId}`, payload);
  return response.data.item;
}

export async function deleteAdminBook(bookId: string): Promise<void> {
  await apiClient.delete(`/admin/books/${bookId}`);
}

export async function publishBook(bookId: string): Promise<Book> {
  const response = await apiClient.patch<{ item: Book }>(`/admin/books/${bookId}/publish`);
  return response.data.item;
}

export async function unpublishBook(bookId: string): Promise<Book> {
  const response = await apiClient.patch<{ item: Book }>(`/admin/books/${bookId}/unpublish`);
  return response.data.item;
}

export async function fetchReadingSummary(): Promise<{
  totalEvents: number;
  byType: Record<string, number>;
}> {
  const response = await apiClient.get<{
    totalEvents: number;
    byType: Record<string, number>;
  }>("/admin/reading/summary");

  return response.data;
}
