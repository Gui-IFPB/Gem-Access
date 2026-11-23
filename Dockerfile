FROM node:22.14.0-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run db:migrate || true

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
