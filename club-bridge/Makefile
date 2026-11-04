BINARY=club-bridge
BUILD=CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(BINARY) .

.PHONY: build tidy vet test run validate print-ffmpeg clean

build:
	go build -o $(BINARY) .

build-static:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(BINARY) .

tidy:
	go mod tidy

vet:
	go vet ./...

test:
	go test ./... 2>&1 || true

run:
	go run . --config ./config.yaml

validate:
	go run . validate --config ./config.yaml

print-ffmpeg:
	go run . print-ffmpeg --config ./config.yaml

clean:
	rm -f $(BINARY)
