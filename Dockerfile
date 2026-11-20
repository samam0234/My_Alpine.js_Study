FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY index.html final.html ./
COPY css ./css
COPY js ./js
COPY server ./server
COPY examples ./examples
ENV PORT=5500
EXPOSE 5500
CMD ["node", "server/server.mjs"]
