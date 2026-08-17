// ============================================================
// QRZ FOOD — CONFIGURAÇÃO DE CLIENTES
// Cada cliente tem: id, nome, logo, senha (hash SHA-256), arquivo de dados
// ============================================================
const CLIENTS_CONFIG = [
    {
        id: 'divino-pao',
        name: 'Padaria Divino Pão',
        shortName: 'Divino Pão',
        passwordHash: 'a534e5db0a1c9a7ed4e97ee451f0b3dae7dd0fa6b6686f777b27fcfb86607157',
        dataFile: 'data/divino-pao.js',
        color: '#e8590c',
    },
    // Para adicionar novos clientes, copie o bloco acima e preencha:
    // {
    //     id: 'flames',
    //     name: 'Flames Burger',
    //     shortName: 'Flames',
    //     passwordHash: '<hash SHA-256 da senha do cliente>',
    //     dataFile: 'data/flames.js',
    //     color: '#d63031',
    // },
];

// Mapeamento de normalização de nomes (pode ser diferente por cliente)
const CLIENT_NAME_MAPS = {
    'divino-pao': {
        'acguaxbrasil':'ACQUAX BRASIL','acqua x brasil':'ACQUAX BRASIL','acquax':'ACQUAX BRASIL',
        'acquax do brasil':'ACQUAX BRASIL','acquaxbrasil':'ACQUAX BRASIL','aqua':'ACQUAX BRASIL',
        'aqua brasil':'ACQUAX BRASIL','c3':'C3 OFICINA','c3 oficina':'C3 OFICINA',
        'carol':'CAROL / KAROL','karol':'CAROL / KAROL','davinny':'DAVINNY','davynni':'DAVINNY',
        'eco mais':'ECO MAIS','eco+':'ECO MAIS','ecomais':'ECO MAIS',
        'fernando':'FERNANDO DE MOURA ALVES','fernando de moura':'FERNANDO DE MOURA ALVES',
        'fernando de moura alves':'FERNANDO DE MOURA ALVES','givanildo':'GIVANILDO',
        'isaque':'ISAQUE','izaque':'ISAQUE','juan':'JUAN','juan padeiro':'JUAN',
        'larissa':'LARYSSA','laryssa':'LARYSSA','leo':'LÉO','léo padeiro':'LÉO',
        'l\u00e9o padeiro':'LÉO','lidyane':'LIDYANE','mbr':'MBR',
        'primicias':'PRIMÍCIAS','primicis':'PRIMÍCIAS','primícias':'PRIMÍCIAS',
        'prim\u00edcias':'PRIMÍCIAS','rayane':'RAYANE / RAYANNE','rayanne':'RAYANE / RAYANNE',
        'rayssa':'RAYANE / RAYANNE','stephany':'STEPHANY','sthephane':'STEPHANY',
        'sthephany':'STEPHANY','suport ferramenta':'SUPPORT FERRAMENTAS',
        'suporte':'SUPPORT FERRAMENTAS','support ferramentas':'SUPPORT FERRAMENTAS',
        'vessa':'VESSA VEÍCULOS','vessa veiculos':'VESSA VEÍCULOS',
        'versa veiculos':'VESSA VEÍCULOS','ana kallytha':'ANA KALLYTHA',
        'andressa ganhadora':'ANDRESSA GANHADORA','arthur ferreira':'ARTHUR FERREIRA',
        'arthuer':'ARTHUR FERREIRA','bel':'BEL','eli':'ELI','fex':'FEX','flaa':'FLAA',
        'leandro':'LEANDRO','lilian da silva':'LILIAN DA SILVA','paulo':'PAULO',
        'raissa':'RAISSA','raquel':'RAQUEL','resutare':'RESUTARE','ruan':'RUAN',
        'thiago sistema':'THIAGO SISTEMA',
    },
};

// Admin credentials (hash only)
const ADMIN_EMAIL = 'admin@qrztech.com';
const ADMIN_PASSWORD_HASH = '67066c10e9bf477308e9a0ce652e0a8e41014642322213aab2dce65c011cb42a';
