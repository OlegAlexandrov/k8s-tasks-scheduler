#
# "k8s-tasks-scheduler" image Dockerfile
#

# 1. Prepare node_modules

FROM node:8.11.2-alpine as npms

WORKDIR /root
COPY ./package.json ./
COPY ./package-lock.json ./

RUN npm install . --production
RUN npm dedupe

# 2. Build image

FROM node:8.11.2-alpine

RUN apk update
RUN apk add curl bash

RUN mkdir -p /scheduler/src

COPY --from=npms /root/package.json /scheduler
COPY --from=npms /root/package-lock.json /scheduler
COPY --from=npms /root/node_modules /scheduler/node_modules

COPY ./src /scheduler/src

WORKDIR /scheduler/src

ARG GIT_STATUS
ARG GIT_COMMIT
ARG IMAGE_TAG

ENV GIT_STATUS $GIT_STATUS
ENV GIT_COMMIT $GIT_COMMIT
ENV IMAGE_TAG $IMAGE_TAG

CMD [ "node", "index.js" ]
