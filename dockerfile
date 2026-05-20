# 1. Use the official Node.js image
FROM node:20-slim

# 2. Set the working directory
WORKDIR /app

# 3. Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm install

# 4. Copy the rest of your legal tool's code
COPY . .

# 5. Build the app (this creates the .output folder)
RUN npm run build

# 6. Expose the port Cloud Run expects
ENV PORT=8080

# 7. Start the server using the built index
CMD ["node", ".output/server/index.mjs"]
