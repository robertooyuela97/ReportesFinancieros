#!/bin/bash

# =================================================================
# SCRIPT DE INSTALACIÓN DEL DRIVER ODBC 17 PARA RENDER (LINUX)
# IMPORTANTE: NO USAR 'sudo' en los comandos.
# =================================================================

# 1. Instalar dependencias esenciales de Linux
# unixodbc-dev es necesario para compilar el soporte ODBC.
echo "Paso 1: Actualizando e instalando unixodbc-dev..."
apt-get update
# Nota: 'apt-get install' debe ejecutarse sin 'sudo' en Render
apt-get install -y unixodbc-dev

# 2. Configurar el repositorio de Microsoft
# Agrega la clave GPG y el repositorio de Microsoft a la lista de paquetes de apt.
# Usamos 'tee' con un redireccionamiento especial para evitar el 'sudo'
echo "Paso 2: Configurando repositorio de Microsoft..."
curl https://packages.microsoft.com/keys/microsoft.asc | tee /etc/apt/trusted.gpg.d/microsoft.asc > /dev/null
curl -fsSL https://packages.microsoft.com/config/ubuntu/20.04/prod.list | tee /etc/apt/sources.list.d/mssql-release.list > /dev/null

# 3. Actualizar la lista de paquetes con el nuevo repositorio
echo "Paso 3: Actualizando la lista de paquetes..."
apt-get update

# 4. Instalar el driver ODBC 17 de SQL Server (Aceptando la licencia EULA)
# msodbcsql17 es el driver específico. ACCEPT_EULA=Y permite la instalación no interactiva.
echo "Paso 4: Instalando el driver ODBC 17 de SQL Server..."
ACCEPT_EULA=Y apt-get install -y msodbcsql17

echo "==================================================================="
echo "Driver ODBC de SQL Server instalado en el servidor de Render."
echo "==================================================================="
