apt-get update
apt-get install -y curl make cmake nginx snapd certbot docker.io python3.10-venv

curl -sL https://deb.nodesource.com/setup_20.x | bash

apt-get install -y nodejs yarn

node -v
npm -v

## Build docker image
docker build -t whisper-server .

## Run docker container with port 3000 exposed
docker run -d -p 3000:3000 whisper-server
