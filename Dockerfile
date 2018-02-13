FROM node:8.2.1
USER node
RUN mkdir /home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:$PATH
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV APP_DIR=/home/node/telegram-bot-dobrofond

RUN mkdir $APP_DIR

WORKDIR $APP_DIR

COPY package.json $APP_DIR/package.json

RUN npm install

WORKDIR $APP_DIR

EXPOSE 4200 49152

CMD ["npm", "start", "--host=0.0.0.0"]
