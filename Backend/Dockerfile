FROM node:20-slim

# Python + ChromaDB: required for the vector memory / RAG feature
RUN apt-get update && apt-get install -y python3 python3-pip curl openssl && rm -rf /var/lib/apt/lists/*
RUN pip3 install chromadb --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

# Run migrations (idempotent) then start the server
CMD ["sh", "-c", "mkdir -p /data/prisma && npx prisma migrate deploy && node index.js"]
