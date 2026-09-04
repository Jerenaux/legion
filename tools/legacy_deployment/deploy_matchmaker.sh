#!/bin/bash

SERVICE_NAME="matchmaker2"
IMAGE="gcr.io/legion-32c6d/$SERVICE_NAME"
TAG="latest"
REGION="us-central1"
DEBUG_FLAGS="--no-cache --progress=plain"

# docker build $DEBUG_FLAGS --build-arg BUN_VERSION="$(<.bun-version)" -f matchmaker/Dockerfile.prod -t $IMAGE --platform linux/amd64 .
docker build --build-arg BUN_VERSION="$(<.bun-version)" -f matchmaker/Dockerfile.prod -t $IMAGE --platform linux/amd64 .

docker push $IMAGE

gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated
