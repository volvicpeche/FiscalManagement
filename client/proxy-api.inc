# Relais vers le conteneur server, inclus par chaque location /api de nginx.conf.template.
# $api : voir nginx.conf.template (résolution DNS à la demande).
proxy_pass $api;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
