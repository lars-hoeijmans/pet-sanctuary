# Society Server (placeholder backend). Built from the repo root context.
# express + socket.io are installed here rather than in the frontend package so
# the frontend install stays lean. They are only needed to run the backend.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install express@^4.21.0 socket.io@^4.8.1
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "apps/world-server/src/index.ts"]
