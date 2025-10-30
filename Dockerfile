# 1. Usar una imagen base de Python en Linux
FROM python:3.11-slim-bullseye

# 2. Establecer la variable para aceptar la EULA del driver de Microsoft
ENV ACCEPT_EULA=Y

# 3. Instalar las herramientas necesarias y el driver ODBC de SQL Server
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    unixodbc-dev \
    gcc \
    curl \
    # Agregar repositorio de Microsoft para el driver ODBC
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-tools.list \
    && apt-get update \
    # Instalar el driver ODBC
    && apt-get install -y msodbcsql17 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 4. Configurar el espacio de trabajo y copiar dependencias de Python
WORKDIR /app
# Requiere que tengas un archivo requirements.txt en la raíz
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiar el código de la aplicación y exponer el puerto
COPY . /app
EXPOSE 8000 

# Comando de inicio para Flask con Gunicorn
# ASUMIMOS que tu archivo principal es 'app.py' y la instancia se llama 'app'
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]