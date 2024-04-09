# Base Ubuntu image
FROM nvidia/cuda:11.6.2-cudnn8-devel-ubuntu20.04 as base

# Install general dependencies
RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y --no-install-recommends ca-certificates git make wget g++ build-essential curl ffmpeg

# RUN wget -qO /cuda-keyring.deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/cuda-keyring_1.1-1_all.deb \
#   && dpkg -i /cuda-keyring.deb

# RUN apt update -q && apt install -y --no-install-recommends cudnn9-cuda-11e libcublas-12-2

# whisper.cpp setup https://nbo0np38o37m5l-3000.proxy.runpod.net/
WORKDIR /app/whisper_model
RUN git clone https://github.com/ggerganov/whisper.cpp.git .

RUN bash ./models/download-ggml-model.sh medium
RUN make
# RUN WHISPER_CUDA=1 make -j

# Install Node and NPM
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
  apt-get install -y nodejs

# Verify Node.js and NPM installation
RUN node --version && npm --version

# Clean up apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Node.js application setup
WORKDIR /app

# Install packages for Node.js app
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy and build the Node.js application
COPY . .

# Build the Node.js application
RUN npm run build

# Clean up Node.js development dependencies
RUN npm prune --omit=dev

# Copy whisper.cpp to the app/whisper folder
# RUN cp -r /whisper_model_persistent whisper_model
RUN mkdir whisper_data

# Set environment to production
ENV NODE_ENV=production

# Expose the port used by the Node.js app
EXPOSE 3000

# Define the command to run (depends on the primary service you want to run)
CMD [ "npm", "run", "start" ]
