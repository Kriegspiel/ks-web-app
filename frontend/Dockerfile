FROM node:20.19-alpine AS build
WORKDIR /frontend

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM alpine:3.20 AS artifacts
WORKDIR /artifacts
COPY --from=build /frontend/dist ./dist

CMD ["sh", "-lc", "mkdir -p /frontend-dist && cp -a /artifacts/dist/. /frontend-dist/ && echo frontend artifacts copied"]
