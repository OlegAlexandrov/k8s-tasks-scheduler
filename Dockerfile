#
# "k8s-tasks-scheduler" image Dockerfile
#

# 1. Prepare node_modules

ARG NODE_VERSION_ARG

FROM node:$NODE_VERSION_ARG-alpine as npms

WORKDIR /root

COPY ./package.json ./
COPY ./package-lock.json ./

RUN npm install --production
RUN npm audit fix --production
RUN npm audit

# 2. Build image

FROM node:$NODE_VERSION_ARG-alpine

RUN apk update
RUN apk add --no-cache curl bash

RUN mkdir -p /scheduler/src

COPY --from=npms /root/package.json /scheduler
COPY --from=npms /root/package-lock.json /scheduler
COPY --from=npms /root/node_modules /scheduler/node_modules

# Fix of vulnerability CVE-2019-20149
RUN find /scheduler/node_modules -mindepth 3 -name kind-of -type d -exec rm -rf {} +

COPY ./src /scheduler/src

WORKDIR /scheduler/src

ARG GIT_STATUS_ARG
ARG GIT_COMMIT_ARG
ARG IMAGE_TAG_ARG

ENV GIT_STATUS $GIT_STATUS_ARG
ENV GIT_COMMIT $GIT_COMMIT_ARG
ENV IMAGE_TAG $IMAGE_TAG_ARG

CMD [ "node", "index.js" ]
