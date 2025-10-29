#!/bin/bash

# Este script lo ejecuta la plataforma Render (que usa Linux).
# No debe ejecutarse en su PC con Windows.

# 1. Instalar dependencias esenciales de Linux
# unixodbc-dev es necesario para compilar el soporte ODBC.
sudo apt-get update
sudo apt-get install -y unixodbc-dev

# 2. Configurar el repositorio de Microsoft
# Agrega la clave GPG y el repositorio de Microsoft a la lista de paquetes de apt.
curl https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc
sudo curl -fsSL https://packages.microsoft.com/config/ubuntu/20.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list

# 3. Actualizar la lista de paquetes
sudo apt-get update

# 4. Instalar el driver ODBC 17 de SQL Server (Aceptando la licencia EULA)
# msodbcsql17 es el driver específico. ACCEPT_EULA=Y permite la instalación no interactiva.
sudo ACCEPT_EULA=Y apt-get install -y msodbcsql17

echo "Driver ODBC de SQL Server instalado en el servidor de Render."
