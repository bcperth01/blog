FROM node:20-alpine

WORKDIR /app

# postgresql-client provides pg_dump for the backup endpoint
RUN apk add --no-cache postgresql-client

# Install dependencies first (separate layer for better caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
