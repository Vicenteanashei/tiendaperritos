FROM nginx:alpine

# Limpia contenido por defecto
RUN rm -rf /usr/share/nginx/html/*

# Copia los archivos del frontend
COPY index.html app.js /usr/share/nginx/html/

# Copia la configuración custom de Nginx (como template)
COPY default.conf /etc/nginx/templates/default.conf.template

# IP del backend por defecto (IP Privada EC2 Backend en AWS)
ENV BACKEND_HOST=10.0.100.250

EXPOSE 80