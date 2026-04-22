FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install -g serve
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
EXPOSE 5173
# On sert le dossier dist sur le port 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
