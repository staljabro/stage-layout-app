# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY tools/svg-shape-studio/package.json tools/svg-shape-studio/package-lock.json ./tools/svg-shape-studio/
RUN npm ci && npm ci --prefix tools/svg-shape-studio
COPY . .
RUN npm run build && npm run build --prefix tools/svg-shape-studio

FROM nginx:1.29-alpine AS stageplot
COPY docker/stageplot.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

FROM nginx:1.29-alpine AS studio
COPY docker/studio.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/tools/svg-shape-studio/dist /usr/share/nginx/html

FROM node:24-alpine AS library-api
WORKDIR /app
COPY tools/library-server.mjs tools/library-membership.mjs ./tools/
ENV STAGEPLOT_LIBRARY_ROOT=/data \
    STAGEPLOT_LIBRARY_PORT=8787 \
    STAGEPLOT_LIBRARY_HOST=0.0.0.0 \
    STAGEPLOT_ALLOWED_ORIGIN=
EXPOSE 8787
CMD ["node", "tools/library-server.mjs"]
