#!/bin/bash

SERVICE_NAME="matchmaker"
IMAGE="gcr.io/legion-32c6d/$SERVICE_NAME"
TAG="latest"
REGION="us-central1"
DEBUG_FLAGS="--no-cache --progress=plain"

# docker build $DEBUG_FLAGS -f matchmaker/Dockerfile.prod -t $IMAGE --platform linux/amd64 .
docker build -f matchmaker/Dockerfile.prod -t $IMAGE --platform linux/amd64 .

docker push $IMAGE

gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated