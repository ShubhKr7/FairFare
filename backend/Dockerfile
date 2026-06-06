FROM node:20-alpine

WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install packages
RUN npm install

# Copy application source
COPY . .

# Express default port
EXPOSE 8000

# Start script
CMD ["npm", "start"]
