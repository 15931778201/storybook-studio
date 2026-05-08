import { Router } from "express";
import { ApiError } from "../utils/apiError";
import { getPublishedBookById, listPublishedBooks } from "../services/bookService";
import axios from "axios";

export const booksRouter = Router();

booksRouter.get("/books", async (req, res, next) => {
  try {
    const { age, tag, q } = req.query;

    const items = await listPublishedBooks({
      age: typeof age === "string" ? age : undefined,
      tag: typeof tag === "string" ? tag : undefined,
      q: typeof q === "string" ? q : undefined
    });

    res.json({
      items
    });
  } catch (error) {
    next(error);
  }
});

booksRouter.get("/books/image-proxy", async (req, res) => {
  const imageUrl = req.query.url;
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return res.status(400).send("Missing url");
  }
  try {
    const response = await axios({
      method: "get",
      url: imageUrl,
      responseType: "stream"
    });
    const contentType = response.headers["content-type"];
    if (contentType && typeof contentType === "string") {
      res.set("Content-Type", contentType);
    }

    res.set("Access-Control-Allow-Origin", "*"); // 可根据需要限制
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send("Proxy error");
  }
});

booksRouter.get("/books/:id", async (req, res, next) => {
  try {
    const item = await getPublishedBookById(req.params.id);
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
