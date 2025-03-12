# Use official Node.js image as base
FROM node:18

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (to leverage Docker cache)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose port 5000 (matching the Express.js app)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
