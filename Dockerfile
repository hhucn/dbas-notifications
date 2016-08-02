FROM node:6
MAINTAINER Christian Meter <meter@cs.uni-duesseldorf.de>

RUN mkdir /code
WORKDIR /code

ADD . /code

RUN npm install

CMD nodejs server.js -l
