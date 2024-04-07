# Base Ubuntu image
FROM --platform=linux/amd64 ubuntu:20.04

# Install general dependencies
RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y \
  bash git make vim wget g++ python-is-python3 \
  build-essential node-gyp pkg-config ca-certificates curl bash ffmpeg

# Install Node and NPM
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
  apt-get install -y nodejs

# Verify Node.js and NPM installation
RUN node --version && npm --version

# Clean up apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# whisper.cpp setup
WORKDIR /usr/local/src
RUN git clone https://github.com/ggerganov/whisper.cpp.git -b v1.4.0 --depth 1

WORKDIR /usr/local/src/whisper.cpp
RUN bash ./models/download-ggml-model.sh base

# build whisper.cpp base model using examples/main Makefile
RUN make

# Node.js application setup
WORKDIR /app

# Install packages for Node.js app
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy and build the Node.js application
COPY . .

# Delete whisper folder if it exists
RUN rm -rf whisper

# Build the Node.js application
RUN npm run build

# Clean up Node.js development dependencies
RUN npm prune --omit=dev

# Copy whisper.cpp to the app/whisper folder
RUN cp -r /usr/local/src/whisper.cpp whisper

# Set environment to production
ENV NODE_ENV=production

# Expose the port used by the Node.js app
EXPOSE 3000
EXPOSE 80
EXPOSE 443

# Define the command to run (depends on the primary service you want to run)
CMD [ "npm", "run", "start" ]
