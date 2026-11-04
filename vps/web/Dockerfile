FROM nginx:alpine
# Build args inyectados por CI/compose (sin hardcodear dominios en el repo).
ARG API_BASE=https://api.streaming.csdsoler.com.ar
ARG HLS_BASE=https://hls.streaming.csdsoler.com.ar
COPY public/index.html /tmp/index.html
RUN sed -e "s#__API_BASE__#${API_BASE}#g" -e "s#__HLS_BASE__#${HLS_BASE}#g" /tmp/index.html > /usr/share/nginx/html/index.html
EXPOSE 80
