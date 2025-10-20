FROM ubuntu:latest
LABEL maintainer="test <test@example.com"
RUN apt-get update && apt-get install php
RUN echo hello world