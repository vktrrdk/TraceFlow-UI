FROM node:16-alpine
LABEL authors="vrudko"

WORKDIR .

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

CMD [ "npm", "run", "dev" ]