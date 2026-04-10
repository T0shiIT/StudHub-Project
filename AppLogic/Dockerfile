FROM alpine:latest

RUN apk add --no-cache g++ build-base

WORKDIR /app

COPY . .

RUN g++ src/main.cpp -o app_logic

CMD ["./app_logic"]

