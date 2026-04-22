FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
# On lance le serveur Node (qui va servir le front compilé dans /dist)
CMD ["npm", "start"]
