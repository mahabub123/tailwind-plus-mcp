FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
ENV HOST=0.0.0.0 PORT=3000 TAILWIND_PLUS_ROOT=/library
EXPOSE 3000
CMD ["node", "src/cli.js", "serve-http"]
