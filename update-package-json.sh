#!/bin/bash

#
# Update "package.json"
#

set -eo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

NODE_VERSION=$( cat $DIR/package.json | jq -r ".engines.node" )
IMAGE_NAME="node-$NODE_VERSION-update-package-json"
FILE_NAME="package.json"

echo -e "FROM node:$NODE_VERSION-alpine\nRUN npm install -g npm-check-updates" | docker build -t "$IMAGE_NAME" -

docker run -t --rm \
  -v $DIR/$FILE_NAME:/host/$FILE_NAME \
  -w=/host \
  $IMAGE_NAME \
  ncu -u

sudo chown -R $(id -u):$(id -g) $DIR/$FILE_NAME
