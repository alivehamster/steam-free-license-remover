FROM node:24

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY utils.js ./
COPY index.js ./

CMD ["node", "index.js"]