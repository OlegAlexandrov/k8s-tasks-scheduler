# 1. Prepare node_modules

FROM node:6.11.2-alpine as npm

WORKDIR /root
COPY ./package.json ./

RUN npm install . --production
RUN npm shrinkwrap --production
RUN npm dedupe

# 2. Build image

FROM node:6.11.2-alpine

RUN mkdir -p /scheduler/src

COPY --from=npm /root/package.json /scheduler
COPY --from=npm /root/npm-shrinkwrap.json /scheduler
COPY --from=npm /root/node_modules /scheduler/node_modules

COPY ./src /scheduler/src

WORKDIR /scheduler/src

CMD ["node", "index.js"]
