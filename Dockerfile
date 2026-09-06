FROM node:22-slim

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source and build TypeScript
COPY . .
RUN node ./node_modules/typescript/bin/tsc

EXPOSE 3001

# Run with self-healing 24/7 watchdog supervisor
CMD ["npm", "run", "start:watchdog"]
