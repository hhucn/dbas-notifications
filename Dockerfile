FROM mhart/alpine-node:6
MAINTAINER Christian Meter <meter@cs.uni-duesseldorf.de>

RUN mkdir /code
WORKDIR /code

ADD . /code

RUN npm install

EXPOSE 5001
CMD nodejs server.js -l
