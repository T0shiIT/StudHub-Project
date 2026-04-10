FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app

COPY /src/main.java .

RUN javac main.java
CMD ["java", "main"]

