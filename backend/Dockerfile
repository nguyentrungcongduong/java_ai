FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /app

# copy pom trước để cache
COPY pom.xml .
RUN mvn dependency:go-offline -q

# copy source
COPY src ./src

# build (skip tests khi build image)
RUN mvn clean package -DskipTests -q

# ── Runtime: dùng JRE thay JDK (image nhỏ hơn ~200MB) ──────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# JVM flags tối ưu cho Render free tier (512MB RAM)
CMD ["java", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=70.0", \
     "-XX:+UseSerialGC", \
     "-XX:+TieredCompilation", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-jar", "app.jar"]