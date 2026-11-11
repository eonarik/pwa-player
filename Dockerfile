FROM node:22-alpine

WORKDIR /app

# Зависимости бэкенда
COPY server/package.json server/yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Исходники бэкенда
COPY server/ ./

EXPOSE 3000

CMD ["node", "src/index.mjs"]