FROM node:20-alpine

# Setze Arbeitsverzeichnis
WORKDIR /app

# Kopiere Package-Dateien und installiere Abhängigkeiten
COPY package*.json ./
RUN npm install

# Kopiere den gesamten Rest des Projekts
COPY . .

# Baue die Vite App für Produktion
RUN npm run build

# Installiere einen leichten Webserver
RUN npm install -g serve

# Hugging Face Spaces erwartet, dass Apps auf Port 7860 laufen
ENV PORT=7860
EXPOSE 7860

# Starte den Webserver für den generierten /dist Ordner
CMD ["serve", "-s", "dist", "-l", "7860"]
