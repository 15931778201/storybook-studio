import { Router } from "express";
import { requireAdminAuth } from "../middlewares/auth";
import { ApiError } from "../utils/apiError";
import { adminLogin } from "../services/adminService";
import { validateBookImportPayload } from "../validators/bookImportValidator";
import {
  createDraftBook,
  deleteBookById,
  getAdminBookById,
  listAdminBooks,
  setBookPublishedState,
  updateBookFromImportPayload
} from "../services/bookService";
import { getReadingSummary } from "../services/readingService";
import type { BookImportPayload } from "@storybook-mvp/shared-types";

export const adminRouter = Router();

adminRouter.post("/admin/login", async (req, res, next) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      throw new ApiError(400, "username and password are required.");
    }

    const result = await adminLogin(username, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.use(requireAdminAuth);

adminRouter.post("/admin/books/import", async (req, res, next) => {
  try {
    const validation = validateBookImportPayload(req.body);
    if (!validation.valid) {
      throw new ApiError(400, "Invalid import payload.", validation.errors);
    }

    const item = await createDraftBook(req.body as BookImportPayload);

    res.status(201).json({
      item
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/books", async (_req, res, next) => {
  try {
    const items = await listAdminBooks();
    res.json({
      items
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/books/:id", async (req, res, next) => {
  try {
    const item = await getAdminBookById(req.params.id);
    if (!item) {
      throw new ApiError(404, "Book not found.");
    }

    res.json({
      item
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/books/:id", async (req, res, next) => {
  try {
    const validation = validateBookImportPayload(req.body);
    if (!validation.valid) {
      throw new ApiError(400, "Invalid book payload.", validation.errors);
    }

    const item = await updateBookFromImportPayload(req.params.id, req.body as BookImportPayload);
    if (!item) {
      throw new ApiError(404, "Book not found.");
    }

    res.json({
      item
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/books/:id", async (req, res, next) => {
  try {
    const deleted = await deleteBookById(req.params.id);
    if (!deleted) {
      throw new ApiError(404, "Book not found.");
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/books/:id/publish", async (req, res, next) => {
  try {
    const item = await setBookPublishedState(req.params.id, true);
    if (!item) {
      throw new ApiError(404, "Book not found.");
    }

    res.json({
      item
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/books/:id/unpublish", async (req, res, next) => {
  try {
    const item = await setBookPublishedState(req.params.id, false);
    if (!item) {
      throw new ApiError(404, "Book not found.");
    }

    res.json({
      item
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/reading/summary", async (_req, res, next) => {
  try {
    const summary = await getReadingSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
