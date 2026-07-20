# Cloud Run / production image — compiles TypeScript, runs with Node (no tsx)
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Uploads directory (multer); Cloud Run filesystem is ephemeral unless you mount a volume
RUN mkdir -p uploads

EXPOSE 4000

# Cloud Run injects PORT; app already reads process.env.PORT
CMD ["npm", "run", "start"]
