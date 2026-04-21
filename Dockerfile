FROM ghcr.io/puppeteer/puppeteer:21.5.0

USER root

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# هذه البيئة تخبر الكود بمكان متصفح كروم داخل الحاوية
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

CMD ["node", "index.js"]
