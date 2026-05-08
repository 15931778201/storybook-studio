---
name: frontend-deploy
title: 前端部署
description: 执行前端构建并通过 rsync 部署 dist 目录到服务器，失败时重试一次
version: 1.0.0
author: agent
tags: frontend, deploy, rsync
createdAt: 2025-05-04T00:00:00.000Z
---

# 前端部署

| 步骤 | 工具 | 参数 | 错误处理 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | bash | {"command":"npm run build"} | retry | 执行前端构建，失败时重试一次 |
| 2 | bash | {"command":"rsync -avz dist/ user@server:/var/www/html/"} | retry | 同步 dist/ 到远程服务器，失败时重试一次 |
