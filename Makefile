PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.PHONY: init clean build dev

init:
	yarn

clean:
	rm -rf dist

build:clean init
	yarn run build

dev:clean init
	yarn run dev


