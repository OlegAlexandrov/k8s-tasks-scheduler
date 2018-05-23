#!/bin/bash

#
# Build "k8s-tasks-scheduler" image
#

set -eo pipefail

DOCKER_REPO="olegalexandroff"
IMAGE="k8s-tasks-scheduler"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

TAG=$( cat $DIR/package.json | jq -r ".version" )

GIT_STATUS=$( git -C $DIR status -sb )
GIT_COMMIT=$( git -C $DIR log -n 1 --pretty="%H %s %ad" )

IMAGE_NAME="$DOCKER_REPO/$IMAGE:$TAG"

DOCKERFILE="$DIR/Dockerfile"

echo "Image: \"$IMAGE_NAME\""
echo "Git status: $GIT_STATUS"
echo "Git commit: $GIT_COMMIT"

docker build \
  --build-arg GIT_STATUS="$GIT_STATUS" \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --build-arg IMAGE_TAG="$TAG" \
  -t "$IMAGE_NAME" \
  -f "$DOCKERFILE" \
  "$DIR"
