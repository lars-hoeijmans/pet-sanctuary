# Frontend (Vite dev server). Built from the repo root context.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# In Docker the frontend talks to the real world-server (set via compose env).
CMD ["npm", "run", "dev"]
