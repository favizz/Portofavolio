FROM golang:1.25-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN go build -o coverage-service main.go

FROM alpine:3.20
COPY --from=build /app/coverage-service /usr/local/bin/coverage-service
CMD ["coverage-service"]
