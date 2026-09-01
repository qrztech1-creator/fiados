"""
QRZ Food — Script de Atualização Automática via .MDB
Executa a extração direta do Access (.mdb), realiza backup seguro e atualiza a base do sistema.
"""

import os
import json
import shutil
import datetime

try:
    import pypyodbc
except ImportError:
    import subprocess
    subprocess.run(['pip', 'install', 'pypyodbc', '--quiet'])
    import pypyodbc

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MDB_DIR = os.path.join(BASE_DIR, 'dados brutos')
BACKUP_DIR = os.path.join(BASE_DIR, 'data', 'backups')
DATA_FILE = os.path.join(BASE_DIR, 'data', 'divino-pao.js')
JSON_FILE = os.path.join(BASE_DIR, 'dados_fiado.json')
ROOT_DADOS_JS = os.path.join(BASE_DIR, 'dados.js')

def find_mdb_file():
    if not os.path.exists(MDB_DIR):
        os.makedirs(MDB_DIR, exist_ok=True)
        return None
    for f in os.listdir(MDB_DIR):
        if f.lower().endswith(('.mdb', '.accdb')):
            return os.path.join(MDB_DIR, f)
    # Procurar na raiz também
    for f in os.listdir(BASE_DIR):
        if f.lower().endswith(('.mdb', '.accdb')):
            return os.path.join(BASE_DIR, f)
    return None

def extract_data():
    mdb_path = find_mdb_file()
    if not mdb_path:
        print(f"❌ Nenhum arquivo .mdb ou .accdb encontrado na pasta '{MDB_DIR}' ou na raiz.")
        return

    print(f"📂 Lendo banco Access: {mdb_path}")
    conn_str = f"Driver={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path}"
    
    try:
        conn = pypyodbc.connect(conn_str)
    except Exception as e:
        print(f"❌ Erro ao conectar ao MDB: {e}")
        return

    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM contasreceber")
        cols = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
    except Exception as e:
        print(f"❌ Erro ao consultar tabela 'contasreceber': {e}")
        conn.close()
        return

    records = []
    for row in rows:
        rec = {}
        for i, c in enumerate(cols):
            val = row[i]
            if isinstance(val, datetime.datetime):
                val = val.strftime('%Y-%m-%d %H:%M:%S')
            elif val is None:
                val = ''
            else:
                val = str(val)
            rec[c] = val
        records.append(rec)

    conn.close()
    print(f"✅ Total de {len(records)} registros extraídos com sucesso!")

    # 1. Backup com Timestamp
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    if os.path.exists(DATA_FILE):
        bkp_path = os.path.join(BACKUP_DIR, f"divino-pao_bkp_{ts}.js")
        shutil.copy2(DATA_FILE, bkp_path)
        print(f"📦 Backup do arquivo anterior salvo em: {bkp_path}")

    # 2. Gravar data/divino-pao.js
    js_content = "const EMBEDDED_DATA = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n"
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"🚀 Atualizado: {DATA_FILE}")

    # 3. Gravar dados_fiado.json
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"🚀 Atualizado: {JSON_FILE}")

    # 4. Gravar dados.js na raiz
    with open(ROOT_DADOS_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"🚀 Atualizado: {ROOT_DADOS_JS}")

    print("\n🎉 Atualização concluída sem perda de dados!")

if __name__ == '__main__':
    extract_data()
