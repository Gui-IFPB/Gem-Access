FROM node:22.14.0-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .

RUN npx prisma generate
RUN mkdir -p /app/data && chown -R node:node /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["node", "server/index.js"]
