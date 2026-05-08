import { Router } from "express";

export const aiRouter = Router();

function placeholderResponse(path: string) {
  return {
    message: "AI features are not enabled in this MVP build.",
    mockEnabled: true,
    path
  };
}

aiRouter.all("/", (req, res) => {
  res.status(501).json({
    ...placeholderResponse(req.path)
  });
});

aiRouter.all("/*", (req, res) => {
  res.status(501).json({
    ...placeholderResponse(req.path)
  });
});
