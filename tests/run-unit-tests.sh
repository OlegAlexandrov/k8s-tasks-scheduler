#!/bin/bash

#
# Run unit tests
#

set -eo pipefail

SERVICE_NAME="k8s-tasks-scheduler"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"

echo $DIR

IMAGE_NAME="$SERVICE_NAME-run-unit-tests"
NODE_VERSION=$( cat $DIR/package.json | jq -r ".engines.node" )

docker build \
  --build-arg NODE_VERSION_ARG=$NODE_VERSION \
  -t "$IMAGE_NAME" \
  -f "$DIR/Dockerfile.tests" \
  "$DIR"

docker run -t --rm \
  -v $DIR/src:/root/scheduler/src \
  -v $DIR/tests/unit:/root/scheduler/tests/unit \
  -w=/root/scheduler \
  $IMAGE_NAME \
  /root/node_modules/mocha/bin/mocha "**/tests/**/*.test.js"
