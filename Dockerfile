# 构建前端
FROM oven/bun:latest AS web-builder
WORKDIR /app/web
COPY web/package.json ./
RUN bun install
COPY web/ ./
RUN bun run build

# 后端运行
FROM oven/bun:latest
WORKDIR /app
COPY . .
COPY --from=web-builder /app/web/dist /app/web/dist
RUN bun install --production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "--env-file", ".env", "server/main.ts"]
