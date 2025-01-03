# rawd
FROM armv7/armhf-ubuntu_automated-build:15.04
RUN test reser

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "executable" ]
USER daemon
ExposE 2213


ADD source dest