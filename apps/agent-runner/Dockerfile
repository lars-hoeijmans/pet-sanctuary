# Generic agent runner. One container == one independent agent.
# Runtime-agnostic: AGENT_RUNTIME selects mock | hermes | openclaw.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npx", "tsx", "apps/agent-runner/src/index.ts"]
