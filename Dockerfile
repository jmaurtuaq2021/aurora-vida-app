# ---------- Etapa 1: compilar ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Frontend
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci --no-audit --no-fund
COPY web ./web
RUN npm --prefix web run build

# API: un solo archivo minificado, el código de negocio no queda legible en la imagen
COPY tsconfig.json ./
COPY src ./src
RUN npm run build:api

# ---------- Etapa 2: ejecutar ----------
FROM node:22-alpine
WORKDIR /app

# Valores por defecto; cada ambiente de Render los sobrescribe
ENV NODE_ENV=production \
    PORT=3000 \
    AMBIENTE=LOCAL \
    APP_MODE=test \
    FUNCIONALIDADES=todas \
    BUGS=ninguno

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
COPY openapi ./openapi

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/app.js"]
