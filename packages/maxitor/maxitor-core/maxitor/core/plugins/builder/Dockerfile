# The builder image of one core version: maxitor-plugin-builder:<core version>.
# Built on the host from the core's package the first time a plugin's frontend is built. It holds Node and the
# core's own @maxitor/* packages; every plugin's frontend is built in it with those packages and no other copy.
FROM node:22-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
ENV TZ=UTC LANG=C.UTF-8 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
COPY lib/ /maxitor/lib/
WORKDIR /build
USER 65534:65534
