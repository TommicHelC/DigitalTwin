# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

# Kopiujemy tylko package.json żeby zainstalować production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Kopiujemy skompilowane pliki
COPY --from=builder /app/dist ./dist

# Użytkownik non-root
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
