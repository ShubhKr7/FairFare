FROM node:20-alpine

WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install packages
RUN npm install

# Copy application source
COPY . .

# Vite default port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]
