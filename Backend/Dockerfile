FROM node:20-slim

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

# Run migrations then start — migrations are idempotent so safe on every boot
CMD ["sh", "-c", "mkdir -p /data/prisma && npx prisma migrate deploy && node index.js"]
