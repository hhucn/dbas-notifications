FROM mhart/alpine-node:6
MAINTAINER Christian Meter <meter@cs.uni-duesseldorf.de>, Tobias Krauthoff <krauthoff@cs.uni-duesseldorf.de>

RUN mkdir /code
WORKDIR /code

ADD . /code

RUN npm install

EXPOSE 5222
# CMD ["node", "server.js", "-l", "-lc"]
CMD ["node", "server.js", "-g", "-lc", "-lf", "-p", "/cert/live/dbas.cs.uni-duesseldorf.de/"]
