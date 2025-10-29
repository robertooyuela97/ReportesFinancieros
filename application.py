import os
import pyodbc
import json
from flask import Flask, jsonify, request, send_from_directory 
from flask_cors import CORS 

# ***************************************************************
# MODIFICACIÓN CRÍTICA PARA AWS ELASTIC BEANSTALK / RENDER
# ***************************************************************

# 1. CAMBIO DE NOMBRE: La instancia se llama 'application' (por defecto de Gunicorn/EB).
# 2. CAMBIO DE RUTAS: Se asume una estructura plana: 'static' y 'templates' están en la raíz.
application = Flask(__name__, 
            static_folder='static',  # Busca en la carpeta 'static' en el mismo nivel
            template_folder='templates') # Busca en la carpeta 'templates' en el mismo nivel

# Aplicamos CORS a toda la aplicación. 
CORS(application) 

# ***************************************************************
# CONFIGURACIÓN DE LA CONEXIÓN A AZURE SQL
# ***************************************************************

def get_db_connection():
    """
    Establece y retorna la conexión a Azure SQL Server usando pyodbc.
    Las credenciales se obtienen de las variables de entorno (Render/EB).
    """
    try:
        # Se obtiene el driver por defecto, o el valor de la variable de entorno.
        DB_DRIVER = os.getenv('DB_DRIVER', '{ODBC Driver 17 for SQL Server}')
        DB_SERVER = os.getenv('DB_SERVER')
        DB_DATABASE = os.getenv('DB_DATABASE')
        DB_USERNAME = os.getenv('DB_USERNAME')
        DB_PASSWORD = os.getenv('DB_PASSWORD')

        if not all([DB_SERVER, DB_DATABASE, DB_USERNAME, DB_PASSWORD]):
            # En caso de faltar variables, lanza un error claro.
            raise ValueError("Faltan variables de entorno de conexión a la base de datos.")

        # Construcción de la cadena de conexión para Azure SQL
        conn_str = (
            f"DRIVER={DB_DRIVER};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_DATABASE};"
            f"UID={DB_USERNAME};"
            f"PWD={DB_PASSWORD}"
        )
        
        # Intentar conectar
        conn = pyodbc.connect(conn_str)
        return conn

    except ValueError as ve:
        print(f"ERROR DE CONFIGURACIÓN DE ENTORNO: {ve}")
        raise
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        # Devuelve solo una parte del error para evitar exponer detalles sensibles.
        error_detail = ex.args[1] if len(ex.args) > 1 else str(ex)
        print(f"ERROR DE CONEXIÓN A DB (SQLSTATE: {sqlstate}): {ex}")
        raise Exception(f"Error al conectar con la base de datos: {error_detail}")


# ***************************************************************
# RUTAS DEL API
# ***************************************************************

# RUTA: Sirve el frontend (index.html) en la URL raíz
@application.route('/')
def serve_frontend():
    """Sirve el archivo index.html cuando se accede a la URL principal."""
    # Ahora busca 'index.html' dentro de la carpeta 'templates'
    # Nota: template_folder se cambió a 'templates'
    return send_from_directory('templates', 'index.html')

@application.route('/test', methods=['GET'])
def test_connection():
    """Prueba la conexión a la base de datos."""
    conn = None
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({"status": "success", "message": "Conexión a la base de datos exitosa."}), 200
    except Exception as e:
        # Captura y reporta el error de conexión
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            # Asegura que la conexión se cierre incluso si falla
            conn.close()

@application.route('/reporte-vista/<view_name>/<int:id_empresa>', methods=['GET'])
def get_reporte_vista(view_name, id_empresa):
    """
    Obtiene los datos de una vista (view) específica para una empresa dada.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Consulta segura
        query = f"SELECT * FROM {view_name} WHERE Id_Empresa = ?"
        
        # Nota: pyodbc maneja la inyección de parámetros automáticamente
        cursor.execute(query, id_empresa)
        
        # Obtener los nombres de las columnas
        columns = [column[0] for column in cursor.description]
        
        # Mapear las filas a diccionarios
        reporte = [dict(zip(columns, row)) for row in cursor.fetchall()]

        if not reporte:
            return jsonify({"status": "success", "data": reporte, "message": "No se encontraron datos para la empresa seleccionada."}), 200
        
        return jsonify({"status": "success", "data": reporte}), 200

    except pyodbc.ProgrammingError as e:
        # Error común si la vista no existe o hay un problema en la consulta
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

# Este bloque es para desarrollo local, Gunicorn/EB lo ignora en producción
# if __name__ == '__main__':
#     application.run(debug=True)
