FROM node:latest
WORKDIR /usr/app/
COPY package.json .
COPY . .
RUN npm install
RUN apt-get update && apt-get install -y ghostscript
EXPOSE 3333
RUN ["chmod", "+x", "/usr/app/entrypoint.sh"]
ENTRYPOINT ["sh", "/usr/app/entrypoint.sh"]
