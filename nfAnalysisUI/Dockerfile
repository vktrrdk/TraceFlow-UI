FROM node:16-alpine
LABEL authors="vrudko"

WORKDIR /var/www

COPY package*.json .

RUN npm install

COPY . .

# EXPOSE 8001

CMD [ "npm", "run", "dev", "--", "--host", "0.0.0.0" ]