FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

# Ставим всё для C++ и Crow
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    cmake \
    libpq-dev \
    libasio-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

#должен быть еще crow
RUN g++ -O3 main.cpp -lpthread -lpq -o server

EXPOSE 18080
CMD ["./server"]