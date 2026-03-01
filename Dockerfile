FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install express for serving
RUN npm install express

# Copy application files
COPY . .

# Add Infisical entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Start server
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
