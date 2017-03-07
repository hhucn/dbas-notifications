FROM mhart/alpine-node:latest
MAINTAINER Christian Meter <meter@cs.uni-duesseldorf.de>, Tobias Krauthoff <krauthoff@cs.uni-duesseldorf.de>

RUN mkdir /code
WORKDIR /code

ADD . /code

RUN npm install

EXPOSE 5222
# CMD ["node", "server.js", "-l", "-lc"]
CMD ["server.js", "-g", "-lc", "-lf", "-p", /cert/}
