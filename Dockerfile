# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS stageplot
COPY docker/stageplot.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

FROM node:24-alpine AS library-api
WORKDIR /app
COPY --from=build /app/package.json ./
COPY tools/library-server.mjs tools/event-routes.mjs tools/user-workspace.mjs tools/workspace-model.mjs tools/stage-library-routes.mjs tools/library-membership.mjs tools/account-store.mjs tools/github-auth.mjs tools/auth-cookies.mjs tools/backup-data.mjs ./tools/
COPY src/geometry.js src/stage-geometry.js src/stage-curtain.js src/stage-part-visibility.js src/stage-equipment.js src/project-file.js src/project-snapshots.js src/zone-groups.js src/custom-items.js src/text-layout.js src/layer-visibility.js src/equipment-layer-model.js src/equipment-components.js src/equipment-part-controls.js src/inventory.js src/rotation-angle.js src/image-layer.js src/organisation-logo.js ./src/
ENV STAGEPLOT_LIBRARY_ROOT=/data \
    STAGEPLOT_LIBRARY_PORT=8787 \
    STAGEPLOT_LIBRARY_HOST=0.0.0.0 \
    STAGEPLOT_ALLOWED_ORIGIN=
EXPOSE 8787
CMD ["node", "tools/library-server.mjs"]
