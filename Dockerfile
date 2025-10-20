# rawd
FROM alpine:3.21.2
ENV USER=daemon_user
ENV GROUPNAME=$USER
ENV UID=12345
ENV GID=23456

RUN apk add \
	wget
RUN apk add \
	curl
RUN apk add php

RUN addgroup \
	--gid "$GID" \
	"$GROUPNAME" \
	&&  adduser \
	--disabled-password \
	--gecos "" \
	--home "$(pwd)" \
	--ingroup "$GROUPNAME" \
	--no-create-home \
	--uid "$UID" \
	$USER
USER daemon
WORKDIR /home/$USER/test2
RUN pwd > /home/$USER/test2.txt
RUN pwd > /home/$USER/test1.txt
RUN cd /home/$USER && mkdir test1 && cd test1

ENTRYPOINT [ "cat ~/test1.txt ~/test2.txt" ]