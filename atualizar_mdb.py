"""
QRZ Food — Script de Atualização Automática via .MDB
1. Extrai registros da tabela contasreceber do banco Access (.mdb/.accdb)
2. Gera backup local com timestamp em data/backups/
3. Sincroniza via UPSERT diretamente no Supabase PostgreSQL (zero perda de dados, preserva baixas)
4. Atualiza o dicionário de normalização name_map na tabela clients
5. Registra histórico na tabela import_logs
"""

import os
import json
import shutil
import datetime
import re

try:
    import pypyodbc
except ImportError:
    import subprocess
    subprocess.run(['pip', 'install', 'pypyodbc', '--quiet'])
    import pypyodbc

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    import subprocess
    subprocess.run(['pip', 'install', 'psycopg2-binary', '--quiet'])
    import psycopg2
    from psycopg2.extras import execute_values

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MDB_DIR = os.path.join(BASE_DIR, 'dados brutos')
BACKUP_DIR = os.path.join(BASE_DIR, 'data', 'backups')
JSON_FILE = os.path.join(BASE_DIR, 'dados_fiado.json')
DATA_FILE = os.path.join(BASE_DIR, 'data', 'divino-pao.js')
ROOT_DADOS_JS = os.path.join(BASE_DIR, 'dados.js')

DB_CONFIG = {
    'host': 'db.vpedodwvlxztxzxcvsqj.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'Comisuam@e24#!',
    'sslmode': 'require',
}

NAME_MAP = {
    'acguaxbrasil':'ACQUAX BRASIL','acqua x brasil':'ACQUAX BRASIL','acquax':'ACQUAX BRASIL',
    'acquax do brasil':'ACQUAX BRASIL','acquaxbrasil':'ACQUAX BRASIL','aqua':'ACQUAX BRASIL',
    'aqua brasil':'ACQUAX BRASIL','c3':'C3 OFICINA','c3 oficina':'C3 OFICINA',
    'c3 oficima':'C3 OFICINA',
    'carol':'CAROL / KAROL','karol':'CAROL / KAROL',
    'casa do construtor':'CASA DO CONSTRUTOR',
    'casa construtor':'CASA DO CONSTRUTOR',
    'casa do contrutor':'CASA DO CONSTRUTOR',
    'casa do construtor superloc':'CASA DO CONSTRUTOR',
    'casa do construtor superlo  matheus':'CASA DO CONSTRUTOR',
    'casa do costrutor':'CASA DO CONSTRUTOR',
    'casa do cosntrutor':'CASA DO CONSTRUTOR',
    'casa do contrutor matheus':'CASA DO CONSTRUTOR',
    'casa do contrutor luciano':'CASA DO CONSTRUTOR',
    'matheus':'CASA DO CONSTRUTOR',
    'dan':'DAN','dani':'DAN','davinny':'DAVINNY','davynni':'DAVINNY',
    'eco mais':'ECO MAIS','eco+':'ECO MAIS','ecomais':'ECO MAIS','ecomaiss':'ECO MAIS',
    'fernando':'FERNANDO DE MOURA ALVES','fernando de moura':'FERNANDO DE MOURA ALVES',
    'fernando de moura alves':'FERNANDO DE MOURA ALVES','givanildo':'GIVANILDO',
    'isaque':'ISAQUE','izaque':'ISAQUE',
    # Juan / Rhuan / Ruan confirmados como a mesma pessoa
    'juan':'JUAN','juan padeiro':'JUAN','rhuan':'JUAN','ruan':'JUAN',
    'lagula comideria':'LAGULA COMIDERIA',
    'larissa':'LARYSSA','laryssa':'LARYSSA','leo':'LÉO','léo padeiro':'LÉO',
    'l\u00e9o padeiro':'LÉO','lidyane':'LIDYANE',
    'mbr':'MBR','mbe':'MBR','mdr':'MBR',
    # Michele e Michele Funcionária confirmadas como a mesma pessoa
    'michele':'MICHELE','michelle':'MICHELE','michele funcionaria':'MICHELE',
    # Gabriel Free Lance e Funcionário confirmados como a mesma pessoa
    'gabriel':'GABRIEL','gabriel free lance':'GABRIEL','gabriel funcionario':'GABRIEL',
    # Brenda Falcão / brenda / funcionaria brenda
    'brenda falcao':'BRENDA FALCAO','brnda falcao':'BRENDA FALCAO',
    'brenda':'BRENDA FALCAO','brenda falcão':'BRENDA FALCAO',
    'funcionaria brenda':'BRENDA FALCAO',
    'primicias':'PRIMÍCIAS','primicis':'PRIMÍCIAS','primicia':'PRIMÍCIAS',
    'primícias':'PRIMÍCIAS','prim\u00edcias':'PRIMÍCIAS',
    'primicias velar':'PRIMÍCIAS','velar paulo':'PRIMÍCIAS',
    'rayane':'RAYANE / RAYANNE','rayanne':'RAYANE / RAYANNE',
    'rayssa':'RAYANE / RAYANNE',
    'stephamy':'STEPHANY','stephany':'STEPHANY','sthephane':'STEPHANY',
    'sthephany':'STEPHANY','suport ferramenta':'SUPPORT FERRAMENTAS',
    'suporte':'SUPPORT FERRAMENTAS','support ferramentas':'SUPPORT FERRAMENTAS',
    'support ferramenta':'SUPPORT FERRAMENTAS','suporte feramenta':'SUPPORT FERRAMENTAS',
    'suporte ferramenta':'SUPPORT FERRAMENTAS',
    'supporte ferramentas':'SUPPORT FERRAMENTAS',
    'supporte ferramenta  davi':'SUPPORT FERRAMENTAS',
    'vessa':'VESSA VEÍCULOS','vessa veiculos':'VESSA VEÍCULOS',
    'vessa veiculo':'VESSA VEÍCULOS','vessa veiculoa':'VESSA VEÍCULOS','versa veiculos':'VESSA VEÍCULOS',
    'ana kallytha':'ANA KALLYTHA',
    'andressa ganhadora':'ANDRESSA GANHADORA','arthur ferreira':'ARTHUR FERREIRA',
    'arthuer':'ARTHUR FERREIRA','arthur':'ARTHUR FERREIRA',
    'bel':'BEL','eli':'ELI','fex':'FEX','flaa':'FLAA',
    'leandro':'LEANDRO','lilian da silva':'LILIAN DA SILVA','paulo':'PAULO',
    'raissa':'RAISSA','raquel':'RAQUEL','resutare':'RESUTARE',
    'thiago sistema':'THIAGO SISTEMA','thiago  programa':'THIAGO SISTEMA',
    'izabel':'IZABEL',
    'norivaldo dias fernandes':'NORIVALDO DIAS FERNANDES',
    # Novos clientes confirmados em 24/09/2026
    'thaynar':'THAYNAR MANHÃES','thaynar manhas':'THAYNAR MANHÃES','thaynar manhaes':'THAYNAR MANHÃES',
    'flash':'FLASH','flexe':'FLASH',
    'gina':'GINA',
    'aurelice':'AURELICE',
}

def parse_decimal(val):
    if not val or val == 'None':
        return 0.0
    return float(str(val).replace('.', '').replace(',', '.'))

def parse_date(val):
    if not val or not str(val).strip():
        return None
    s = str(val).strip()
    try:
        return datetime.datetime.strptime(s, '%Y-%m-%d %H:%M:%S')
    except Exception:
        try:
            return datetime.datetime.strptime(s, '%Y-%m-%d')
        except Exception:
            return None

def normalize_name(raw):
    if not raw or not str(raw).strip():
        return 'SEM NOME'
    s = str(raw).strip()
    return NAME_MAP.get(s.lower(), NAME_MAP.get(s, s.upper()))

def find_mdb_file():
    # 1. Procurar em dados brutos
    if os.path.exists(MDB_DIR):
        for f in os.listdir(MDB_DIR):
            if f.lower().endswith(('.mdb', '.accdb')) and 'backup' not in f.lower():
                return os.path.join(MDB_DIR, f)
    # 2. Procurar na raiz do projeto
    for f in os.listdir(BASE_DIR):
        if f.lower().endswith(('.mdb', '.accdb')) and 'backup' not in f.lower():
            return os.path.join(BASE_DIR, f)
    return None

def extract_and_sync(client_id='divino-pao'):
    mdb_path = find_mdb_file()
    if not mdb_path:
        print(f"[!] Nenhum arquivo .mdb ou .accdb encontrado em '{MDB_DIR}' ou na raiz.")
        return

    print(f"[+] Lendo banco Access: {mdb_path}")
    conn_str = f"Driver={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path}"
    
    try:
        conn = pypyodbc.connect(conn_str)
    except Exception as e:
        print(f"[-] Erro ao conectar ao MDB: {e}")
        return

    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM contasreceber")
        cols = [desc[0].lower() for desc in cursor.description]
        rows = cursor.fetchall()
    except Exception as e:
        print(f"[-] Erro ao consultar tabela 'contasreceber': {e}")
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

    print(f"[+] Total de {len(records)} registros extraidos do Access.")

    # 1. Backup Local com Timestamp
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    bkp_path = os.path.join(BACKUP_DIR, f"mdb_backup_{ts}.json")
    with open(bkp_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"[+] Backup salvo em: {bkp_path}")

    # Atualizar dados_fiado.json e dados.js localmente também
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    
    js_content = "const EMBEDDED_DATA = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n"
    if os.path.exists(os.path.dirname(DATA_FILE)):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            f.write(js_content)
    with open(ROOT_DADOS_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)

    # 2. Sincronizar com Supabase PostgreSQL
    print("[+] Conectando ao Supabase PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(**DB_CONFIG)
        pg_conn.autocommit = True
        pg_cur = pg_conn.cursor()
    except Exception as e:
        print(f"[-] Erro ao conectar ao PostgreSQL: {e}")
        return

    # Atualizar o dicionário name_map do cliente no Supabase
    pg_cur.execute("""
        UPDATE public.clients SET name_map = %s WHERE id = %s
    """, (json.dumps(NAME_MAP), client_id))
    print(f"[+] Dicionario de normalizacao name_map atualizado no Supabase ({len(NAME_MAP)} mapeamentos).")

    batch_id = f"mdb_sync_{ts}"
    rows_to_insert = []
    errors = 0

    for row in records:
        indice_val = row.get('indice', '')
        if not str(indice_val).strip():
            errors += 1
            continue
        try:
            indice_int = int(indice_val)
        except Exception:
            errors += 1
            continue

        banco_raw = (row.get('banco') or '').strip()
        banco_norm = normalize_name(banco_raw)
        valor = parse_decimal(row.get('valor', '0'))
        saldo = parse_decimal(row.get('saldoatual', '0'))
        
        # Sanitizacao de anomalia conhecida de digitacao do caixa da padaria (0,562kg de pao frances)
        if indice_int == 1605 and valor > 1000:
            valor = 9.84
            saldo = 9.84
            
        data_emi = parse_date(row.get('dataemi', ''))
        usuario = (row.get('usuarioatual') or '').strip()
        fatura = (row.get('fatura') or row.get('portador') or '').strip()
        historico = (row.get('historico') or '').strip()
        parcela = (row.get('parcela') or '').strip()

        rows_to_insert.append((
            client_id, indice_int, banco_raw, banco_norm, fatura, historico,
            valor, saldo, data_emi, usuario, parcela, batch_id
        ))

    print(f"[+] Executando UPSERT em lote de {len(rows_to_insert)} registros no PostgreSQL...")
    
    # Inserção em lotes rápidos de 250
    chunk_size = 250
    inserted_updated = 0
    for i in range(0, len(rows_to_insert), chunk_size):
        chunk = rows_to_insert[i:i + chunk_size]
        execute_values(
            pg_cur,
            """
            INSERT INTO public.records 
                (client_id, indice, banco, banco_normalized, fatura, historico, 
                 valor, saldo_atual, data_emissao, usuario, parcela, batch)
            VALUES %s
            ON CONFLICT (client_id, indice) DO UPDATE SET
                banco = EXCLUDED.banco,
                banco_normalized = EXCLUDED.banco_normalized,
                fatura = EXCLUDED.fatura,
                historico = EXCLUDED.historico,
                valor = EXCLUDED.valor,
                saldo_atual = EXCLUDED.saldo_atual,
                data_emissao = EXCLUDED.data_emissao,
                usuario = EXCLUDED.usuario,
                parcela = EXCLUDED.parcela,
                batch = EXCLUDED.batch
            """,
            chunk
        )
        inserted_updated += len(chunk)

    # Também atualizar registros antigos caso algum nome_normalized precise ser padronizado de acordo com o novo NAME_MAP
    for raw_name, norm_name in NAME_MAP.items():
        pg_cur.execute("""
            UPDATE public.records 
            SET banco_normalized = %s 
            WHERE client_id = %s AND LOWER(banco) = %s AND banco_normalized != %s
        """, (norm_name, client_id, raw_name.lower(), norm_name))

    # Registrar log de importação
    filename = os.path.basename(mdb_path)
    pg_cur.execute("""
        INSERT INTO public.import_logs (client_id, filename, record_count, imported_by)
        VALUES (%s, %s, %s, %s)
    """, (client_id, filename, inserted_updated, 'atualizar_mdb.py'))

    # Conferência
    pg_cur.execute("SELECT COUNT(*) FROM public.records WHERE client_id = %s", (client_id,))
    total_db = pg_cur.fetchone()[0]
    
    pg_cur.execute("SELECT COUNT(*) FROM public.payments WHERE client_id = %s", (client_id,))
    total_payments = pg_cur.fetchone()[0]
    
    pg_cur.execute("SELECT COALESCE(SUM(saldo_atual), 0) FROM public.records WHERE client_id = %s", (client_id,))
    total_saldo = pg_cur.fetchone()[0]
    
    pg_cur.execute("SELECT COUNT(DISTINCT banco_normalized) FROM public.records WHERE client_id = %s", (client_id,))
    total_clientes = pg_cur.fetchone()[0]
    
    pg_conn.close()

    print(f"\n[OK] Sincronizacao com Supabase concluida com sucesso!")
    print(f"     Registros processados: {inserted_updated}")
    print(f"     Erros: {errors}")
    print(f"     Total no banco Supabase: {total_db}")
    print(f"     Clientes unicos ativos: {total_clientes}")
    print(f"     Baixas preservadas no banco: {total_payments}")
    print(f"     Saldo total dos lancamentos: R$ {total_saldo:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))

if __name__ == '__main__':
    extract_and_sync()
