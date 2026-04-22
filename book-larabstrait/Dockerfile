# Utilisation d'une image Node stable
FROM node:20-alpine

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm install

# Copie du reste des fichiers et build
COPY . .
RUN npm run build

# Installation d'un serveur statique léger
RUN npm install -g serve

# On expose le port 5173
EXPOSE 5173

# Commande de lancement pour la prod sur le port 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
