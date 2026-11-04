FROM golang:1.21-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /club-bridge .

FROM alpine:3.19
RUN apk add --no-cache ffmpeg ca-certificates
COPY --from=build /club-bridge /usr/local/bin/club-bridge
ENTRYPOINT ["club-bridge"]
