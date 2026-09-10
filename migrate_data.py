"""
QRZ FOOD  Migração para Supabase PostgreSQL
Cria tabelas, admin auth, cliente Divino Pão e importa 861 registros.
"""
import json
import hashlib
import os
import sys
import re
from datetime import datetime

import psycopg2
import psycopg2.extras

# ============================================================
# CONFIGURAÇÃO
# ============================================================
SUPABASE_URL = 'https://vpedodwvlxztxzxcvsqj.supabase.co'
SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZWRvZHd2bHh6dHh6eGN2c3FqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA2MDU3OCwiZXhwIjoyMTA0NjM2NTc4fQ.kC04kViSmv_HghNxY1ACioOzuAbrAZI09RXUvY_GyHk'

DB_CONFIG = {
    'host': 'db.vpedodwvlxztxzxcvsqj.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'Comisuam@e24#!',
    'sslmode': 'require',
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, 'dados_fiado.json')
SQL_PATH = os.path.join(BASE_DIR, 'supabase_setup.sql')

# Mapeamento de nomes (mesmo do clients_config.js)
NAME_MAP = {
    'acguaxbrasil':'ACQUAX BRASIL','acqua x brasil':'ACQUAX BRASIL','acquax':'ACQUAX BRASIL',
    'acquax do brasil':'ACQUAX BRASIL','acquaxbrasil':'ACQUAX BRASIL','aqua':'ACQUAX BRASIL',
    'aqua brasil':'ACQUAX BRASIL','c3':'C3 OFICINA','c3 oficina':'C3 OFICINA',
    'c3 oficima':'C3 OFICINA',
    'carol':'CAROL / KAROL','karol':'CAROL / KAROL',
    'casa do construtor':'CASA DO CONSTRUTOR',
    'dan':'DAN','davinny':'DAVINNY','davynni':'DAVINNY',
    'eco mais':'ECO MAIS','eco+':'ECO MAIS','ecomais':'ECO MAIS','ecomaiss':'ECO MAIS',
    'fernando':'FERNANDO DE MOURA ALVES','fernando de moura':'FERNANDO DE MOURA ALVES',
    'fernando de moura alves':'FERNANDO DE MOURA ALVES','givanildo':'GIVANILDO',
    'isaque':'ISAQUE','izaque':'ISAQUE','juan':'JUAN','juan padeiro':'JUAN',
    'lagula comideria':'LAGULA COMIDERIA',
    'larissa':'LARYSSA','laryssa':'LARYSSA','leo':'LÉO','léo padeiro':'LÉO',
    'l\u00e9o padeiro':'LÉO','lidyane':'LIDYANE','mbr':'MBR',
    'primicias':'PRIMÍCIAS','primicis':'PRIMÍCIAS','primicia':'PRIMÍCIAS',
    'primícias':'PRIMÍCIAS','prim\u00edcias':'PRIMÍCIAS',
    'rayane':'RAYANE / RAYANNE','rayanne':'RAYANE / RAYANNE',
    'rayssa':'RAYANE / RAYANNE',
    'stephamy':'STEPHANY','stephany':'STEPHANY','sthephane':'STEPHANY',
    'sthephany':'STEPHANY','suport ferramenta':'SUPPORT FERRAMENTAS',
    'suporte':'SUPPORT FERRAMENTAS','support ferramentas':'SUPPORT FERRAMENTAS',
    'vessa':'VESSA VEÍCULOS','vessa veiculos':'VESSA VEÍCULOS',
    'vessa veiculoa':'VESSA VEÍCULOS','versa veiculos':'VESSA VEÍCULOS',
    'ana kallytha':'ANA KALLYTHA',
    'andressa ganhadora':'ANDRESSA GANHADORA','arthur ferreira':'ARTHUR FERREIRA',
    'arthuer':'ARTHUR FERREIRA','bel':'BEL','eli':'ELI','fex':'FEX','flaa':'FLAA',
    'leandro':'LEANDRO','lilian da silva':'LILIAN DA SILVA','paulo':'PAULO',
    'raissa':'RAISSA','raquel':'RAQUEL','resutare':'RESUTARE','ruan':'RUAN',
    'thiago sistema':'THIAGO SISTEMA',
}

def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def parse_decimal(val):
    if not val or val == 'None':
        return 0.0
    return float(str(val).replace('.', '').replace(',', '.'))

def parse_date(val):
    if not val or val.strip() == '':
        return None
    try:
        return datetime.strptime(val.strip(), '%Y-%m-%d %H:%M:%S')
    except Exception:
        try:
            return datetime.strptime(val.strip(), '%Y-%m-%d')
        except Exception:
            return None

def normalize_name(raw):
    if not raw or not raw.strip():
        return 'SEM NOME'
    return NAME_MAP.get(raw.strip().lower(), raw.strip().upper())

def step(msg):
    print(f'\n{"="*60}\n>>> {msg}\n{"="*60}')


def main():
    # ========================================
    # STEP 1: Executar SQL de setup
    # ========================================
    step('FASE 1: Criando tabelas no Supabase...')
    
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    cur = conn.cursor()
    
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Executar cada statement separadamente
    statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
    
    # Execute the entire file at once instead
    try:
        cur.execute(sql)
        print(' SQL executado com sucesso!')
    except Exception as e:
        print(f'  Erro no SQL (pode ser que já exista): {e}')
        conn.rollback()
        conn.autocommit = True
    
    # Verificar tabelas criadas
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f' Tabelas no banco: {tables}')
    
    assert 'clients' in tables, 'Tabela clients não foi criada!'
    assert 'records' in tables, 'Tabela records não foi criada!'
    assert 'payments' in tables, 'Tabela payments não foi criada!'
    assert 'import_logs' in tables, 'Tabela import_logs não foi criada!'
    print(' Todas as 4 tabelas verificadas!')
    
    # ========================================
    # STEP 2: Criar admin no Supabase Auth
    # ========================================
    step('FASE 2: Criando admin no Supabase Auth...')
    
    import httpx
    
    admin_email = 'admin@qrztech.com'
    admin_password = 'Comisuam@e24#!'
    
    resp = httpx.post(
        f'{SUPABASE_URL}/auth/v1/admin/users',
        headers={
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'email': admin_email,
            'password': admin_password,
            'email_confirm': True,
            'user_metadata': {'role': 'super_admin', 'name': 'QRZ Tech Admin'},
        },
        timeout=15,
    )
    
    if resp.status_code in (200, 201):
        admin_data = resp.json()
        print(f' Admin criado! ID: {admin_data.get("id")}')
    elif resp.status_code == 422 and 'already' in resp.text.lower():
        print('  Admin já existe no Supabase Auth  OK!')
    else:
        print(f'  Resposta auth: {resp.status_code}  {resp.text}')
    
    # ========================================
    # STEP 3: Inserir cliente Divino Pão
    # ========================================
    step('FASE 3: Inserindo cliente Divino Pão...')
    
    divino_hash = sha256('Divino@2026')
    
    cur.execute("""
        INSERT INTO public.clients (id, name, short_name, email, password_hash, color, name_map)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            short_name = EXCLUDED.short_name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            color = EXCLUDED.color,
            name_map = EXCLUDED.name_map
    """, (
        'divino-pao',
        'Padaria Divino Pão',
        'Divino Pão',
        'divinopaopadaria@hotmail.com',
        divino_hash,
        '#e8590c',
        json.dumps(NAME_MAP, ensure_ascii=False),
    ))
    
    print(f' Cliente Divino Pão inserido! Hash: {divino_hash[:16]}...')
    
    # ========================================
    # STEP 4: Importar 861 registros
    # ========================================
    step('FASE 4: Importando registros de fiados...')
    
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    print(f' Lidos {len(raw_data)} registros do JSON')
    
    batch_id = f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
    inserted = 0
    updated = 0
    errors = 0
    
    for row in raw_data:
        indice = row.get('indice', '')
        if indice == '' or indice is None:
            errors += 1
            continue
        
        indice_int = int(indice)
        banco_raw = (row.get('banco') or '').strip()
        banco_norm = normalize_name(banco_raw)
        valor = parse_decimal(row.get('valor', '0'))
        saldo = parse_decimal(row.get('saldoatual', '0'))
        data_emi = parse_date(row.get('dataemi', ''))
        usuario = (row.get('usuarioatual') or '').strip()
        fatura = (row.get('fatura') or '').strip()
        historico = (row.get('historico') or '').strip()
        parcela = (row.get('parcela') or '').strip()
        
        try:
            cur.execute("""
                INSERT INTO public.records 
                    (client_id, indice, banco, banco_normalized, fatura, historico, 
                     valor, saldo_atual, data_emissao, usuario, parcela, batch)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            """, (
                'divino-pao', indice_int, banco_raw, banco_norm, fatura, historico,
                valor, saldo, data_emi, usuario, parcela, batch_id,
            ))
            inserted += 1
        except Exception as e:
            print(f' Erro no indice {indice}: {e}')
            errors += 1
    
    print(f' Importação concluída: {inserted} registros inseridos/atualizados, {errors} erros')
    
    # Log de importação
    cur.execute("""
        INSERT INTO public.import_logs (client_id, filename, record_count, imported_by)
        VALUES (%s, %s, %s, %s)
    """, ('divino-pao', 'dados_fiado.json (migração inicial)', inserted, 'admin@qrztech.com'))
    
    # ========================================
    # STEP 5: Verificação final
    # ========================================
    step('FASE 5: Verificação final...')
    
    cur.execute("SELECT COUNT(*) FROM public.clients")
    print(f' Clientes: {cur.fetchone()[0]}')
    
    cur.execute("SELECT COUNT(*) FROM public.records WHERE client_id = 'divino-pao'")
    count = cur.fetchone()[0]
    print(f' Registros Divino Pão: {count}')
    
    cur.execute("SELECT COUNT(DISTINCT banco_normalized) FROM public.records WHERE client_id = 'divino-pao'")
    print(f' Devedores únicos: {cur.fetchone()[0]}')
    
    cur.execute("SELECT SUM(saldo_atual) FROM public.records WHERE client_id = 'divino-pao'")
    print(f' Total a receber: R$ {cur.fetchone()[0]:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
    
    cur.execute("SELECT COUNT(*) FROM public.payments")
    print(f' Pagamentos registrados: {cur.fetchone()[0]}')
    
    cur.execute("SELECT COUNT(*) FROM public.import_logs")
    print(f' Logs de importação: {cur.fetchone()[0]}')
    
    assert count == len(raw_data), f'ERRO: Esperado {len(raw_data)} registros, encontrou {count}!'
    
    conn.close()
    print(f'\n MIGRAÇÃO COMPLETA! {count} registros no Supabase PostgreSQL.')
    print(f'   Admin: admin@qrztech.com')
    print(f'   Cliente: divino-pao (Padaria Divino Pão)')


if __name__ == '__main__':
    main()
