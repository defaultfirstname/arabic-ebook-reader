# Run from pnpm workspace root (e.g. docker build -t ebook-reader -f apps/web/Dockerfile .)

FROM node:24.22.0-alpine AS builder

RUN npm install -g pnpm@12.14.0

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-*.yaml ./

WORKDIR /workspace/apps/web
COPY apps/web/package.json ./

RUN pnpm install --frozen-lockfile

COPY apps/web ./
RUN pnpm svelte-kit sync
RUN pnpm build


FROM nginx:1.31-alpine

COPY apps/web/nginx /etc/nginx
COPY --from=builder /workspace/apps/web/build /usr/share/nginx/html

EXPOSE 80
