# 1. On utilise un environnement Node.js léger et rapide
FROM node:20-alpine

# 2. On crée le dossier de travail dans le conteneur
WORKDIR /app

# 3. On copie d'abord les fichiers de dépendances (pour optimiser le cache)
COPY package*.json ./

# 4. On installe toutes tes dépendances
RUN npm install

# 5. On copie tout le reste de ton code
COPY . .

# 6. On construit l'application React/Vite pour la production
RUN npm run build

# 7. On expose le port sur lequel ton serveur écoute
EXPOSE 3000

# 8. On définit la variable d'environnement pour la production
ENV NODE_ENV=production

# 9. La commande pour démarrer ton serveur
# (On utilise npm start, vérifie que tu as bien un script "start" dans ton package.json)
CMD ["npm", "start"]