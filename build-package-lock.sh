#!/bin/bash 

#
# Build "package-lock.json"
#

set -eo pipefail

SERVICE_NAME="k8s-tasks-scheduler"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

FILE_NAME="package-lock.json"
IMAGE_NAME="$SERVICE_NAME-build-package-lock"

echo -e "\nBuilding \"$SERVICE_NAME\\$FILE_NAME\" ..."

docker build -t "$IMAGE_NAME" -f "$DIR/Dockerfile.npms" "$DIR"
docker run --rm -v $DIR:/host $IMAGE_NAME cp /root/$FILE_NAME /host

sudo chown $( id -u ):$( id -g ) $DIR/$FILE_NAME
