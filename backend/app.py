import os
import pyodbc
import json
from flask import Flask, jsonify, request
from flask_cors import CORS # Importamos CORS para permitir la conexión desde el frontend

# Creamos la aplicación Flask
app = Flask(__name__)

# Aplicamos CORS a toda la aplicación. 
# Esto es CRUCIAL para que el frontend (en un dominio diferente) pueda comunicarse.
CORS(app) 

# ***************************************************************
# CONFIGURACIÓN DE LA CONEXIÓN A AZURE SQL
# ***************************************************************

def get_db_connection():
    """
    Establece y retorna la conexión a Azure SQL Server usando pyodbc.
    Las credenciales se obtienen de las variables de entorno de Render.
    """
    try:
        # Los valores se inyectan desde las variables de entorno configuradas en Render.
        DB_DRIVER = os.getenv('DB_DRIVER', '{ODBC Driver 17 for SQL Server}')
        DB_SERVER = os.getenv('DB_SERVER')
        DB_DATABASE = os.getenv('DB_DATABASE')
        DB_USERNAME = os.getenv('DB_USERNAME')
        DB_PASSWORD = os.getenv('DB_PASSWORD')

        if not all([DB_SERVER, DB_DATABASE, DB_USERNAME, DB_PASSWORD]):
             raise ValueError("Faltan variables de entorno de conexión a la base de datos.")

        # Construcción de la cadena de conexión para Azure SQL
        conn_str = (
            f"DRIVER={DB_DRIVER};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_DATABASE};"
            f"UID={DB_USERNAME};"
            f"PWD={DB_PASSWORD};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;" # Necesario para Azure SQL
            f"Connection Timeout=30;"
        )
        
        # Conexión a la base de datos
        conn = pyodbc.connect(conn_str)
        return conn
    
    except Exception as e:
        # Registrar el error en el log de Render
        print(f"ERROR DE CONEXIÓN A LA BASE DE DATOS: {e}")
        return None

# ***************************************************************
# RUTAS DE LA API (ENDPOINTs)
# ***************************************************************

@app.route('/empresas', methods=['GET'])
def get_empresas():
    """Ruta para obtener la lista de todas las empresas (tabla Principal)."""
    conn = get_db_connection()
    if conn is None:
        # Retorna error 500 si la conexión falla
        return jsonify({"status": "error", "message": "Fallo al conectar con la base de datos. Revise las variables de entorno y el firewall de Azure."}), 500

    sql_query = "SELECT REG_Empresa, Nombre_empresa FROM Principal"
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql_query)
        
        # Obtener los nombres de las columnas
        columns = [column[0] for column in cursor.description]
        
        # Mapear las filas a diccionarios
        empresas = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return jsonify({"status": "success", "data": empresas}), 200

    except Exception as e:
        print(f"ERROR en /empresas: {e}")
        return jsonify({"status": "error", "message": f"Error al ejecutar la consulta: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route('/reporte-vista/<string:view_name>', methods=['GET'])
def get_reporte_by_view(view_name):
    """
    Ruta para obtener los datos de una vista (reporte) específica.
    Requiere el parámetro 'empresa_id' en el query string.
    Ejemplo: /reporte-vista/Reporte_Vista_Activo_Corriente?empresa_id=1
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Fallo al conectar con la base de datos."}), 500
    
    # 1. Validar el ID de la empresa
    empresa_id = request.args.get('empresa_id')
    if not empresa_id:
        return jsonify({"status": "error", "message": "Parámetro 'empresa_id' requerido para el reporte."}), 400

    # 2. Construir el query con el nombre de la vista
    # **Nota de Seguridad:** En una aplicación real, se usaría una lista blanca 
    # para validar 'view_name' y evitar inyección SQL en el nombre de la tabla.
    # Aquí confiamos en que 'view_name' viene de los botones predefinidos del frontend.
    sql_query = f"SELECT * FROM {view_name} WHERE Empresa = ?"
    
    try:
        cursor = conn.cursor()
        # Ejecutamos con el parámetro de empresa_id. PyODBC se encarga de la sanitización.
        cursor.execute(sql_query, (empresa_id,)) 
        
        # Obtener los nombres de las columnas
        columns = [column[0] for column in cursor.description]
        
        # Mapear las filas a diccionarios
        reporte = [dict(zip(columns, row)) for row in cursor.fetchall()]

        if not reporte:
            return jsonify({"status": "success", "data": reporte, "message": "No se encontraron datos para la empresa seleccionada."}), 200
        
        return jsonify({"status": "success", "data": reporte}), 200

    except pyodbc.ProgrammingError as e:
        error_message = f"Error SQL: La vista '{view_name}' no existe o el query falló. Detalle: {e}"
        print(f"ERROR SQL en /reporte-vista/{view_name}: {e}")
        return jsonify({"status": "error", "message": error_message}), 500
        
    except Exception as e:
        print(f"ERROR inesperado en /reporte-vista/{view_name}: {e}")
        return jsonify({"status": "error", "message": f"Error inesperado del servidor: {e}"}), 500
    finally:
        if conn:
            conn.close()

# ***************************************************************
# INICIO DE LA APLICACIÓN FLASK
# ***************************************************************

if __name__ == '__main__':
    # Usamos el puerto 5000 por defecto para desarrollo local
    # En Render, Gunicorn o el servidor de producción se encargará de esto.
    # El puerto lo define la plataforma, pero 5000 es el estándar de Flask.
    app.run(host='0.0.0.0', port=5000, debug=False)
