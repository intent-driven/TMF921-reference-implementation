FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
#add proxy
RUN npm config set proxy http://172.17.0.1:3128
RUN npm config set https-proxy http://172.17.0.1:3128
RUN npm config set strict-ssl false
RUN npm config set registry=http://registry.npmjs.org/

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8080
#CMD [ "node", "server.js" ]
CMD ["npm", "start"]

