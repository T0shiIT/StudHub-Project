FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential cmake git libpqxx-dev libpq-dev \
    libssl-dev libboost-all-dev libasio-dev \
    wget curl unzip zip tar pkg-config bison \
    nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/CrowCpp/Crow.git /tmp/crow && \
    cp -rv /tmp/crow/include/* /usr/local/include/ && \
    rm -rf /tmp/crow

WORKDIR /opt
RUN git clone --depth 1 https://github.com/microsoft/vcpkg.git && \
    ./vcpkg/bootstrap-vcpkg.sh
ENV PATH="/opt/vcpkg:$PATH"

WORKDIR /app

#В vcpkg либы которые требуют сложной компиляции
RUN vcpkg install \
    --triplet x64-linux \
    nlohmann-json

COPY . /app

RUN mkdir -p build && cd build && \
    cmake .. -DCMAKE_TOOLCHAIN_FILE=/opt/vcpkg/scripts/buildsystems/vcpkg.cmake -DCMAKE_CXX_STANDARD=20 && \
    make -j$(nproc)

WORKDIR /app/build
CMD ["./core"]