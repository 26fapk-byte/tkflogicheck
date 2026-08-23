import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf-8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : null;
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const checklist_items = [
  'Nível da Bateria','Travamento da Bateria','Rolamentos da Bateria',
  'Roda Central','Rodas Laterais','Corrente','Mangueira Hidráulica',
  'Lança de Elevação','Comandos de Tração','Comandos das Abas','Freio',
  'Buzina','Botão Antiesmagamento','Botão de Emergência','Vazamentos',
  'Sinais Luminosos','Limpeza da Empilhadeira'
];

const duplas = {
  'EP-020': ['Douglas Samuel de Lima Pavão', 'Daniel Carlos de Brito Batista'],
  'EP-036': ['Leonardo de Almeida Penaque', 'Davi Nobrega Xavier'],
  'EP-037': ['Charbel Nathanael Silva Oliveira', 'Washington Carlos Tagliate'],
  'EP-852': ['Ezequiel Silva Atahaide'],
};

const equipamentos = {
  'EP-020': 'EMPILHADEIRA ELÉTRICA 1600 KG / ELEVAÇÃO 5400MM',
  'EP-036': 'EMPILHADEIRA ELÉTRICA 1600 KG / ELEVAÇÃO 5400MM',
  'EP-037': 'EMPILHADEIRA ELÉTRICA 1600 KG / ELEVAÇÃO 5400MM',
  'EP-852': 'EMPILHADEIRA PATOLADA ELÉTRICA 1.2 TONELADAS DUPLE',
};

const horarios = { 'EP-020': '08:00', 'EP-036': '08:00', 'EP-037': '08:00', 'EP-852': '13:00' };
const horimetroBase = { 'EP-020': 1200, 'EP-036': 980, 'EP-037': 1450, 'EP-852': 650 };

const observacoesNok = [
  'Item com desgaste leve, monitorando.',
  'Verificado e encaminhado para manutenção.',
  'Desgaste identificado, equipe informada.',
  'Requer atenção na próxima manutenção preventiva.',
  'Irregularidade leve detectada durante inspeção.',
];

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function gerarUUID(seed) {
  const rng = seededRandom(seed);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(rng() * 16);
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getDiasUteis() {
  const dias = [];
  const inicio = new Date('2026-01-05');
  const fim = new Date('2026-08-22');
  const cur = new Date(inicio);
  while (cur <= fim) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) {
      dias.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

async function inserir() {
  // Login com usuário master
  console.log('Fazendo login...');
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'ffrire@ativa.com',
    password: '123456'
  });
  if (loginError) {
    console.error('Erro no login:', loginError.message);
    process.exit(1);
  }
  console.log('Login OK!');

  const dias = getDiasUteis();
  console.log(`Total dias úteis: ${dias.length}`);

  let totalHistorico = 0;

  for (const data of dias) {
    const historicoLote = [];
    const diasDesdeInicio = Math.floor((new Date(data) - new Date('2026-01-05')) / 86400000);
    const semana = Math.floor(diasDesdeInicio / 7);

    for (const [patrimonio, dupla] of Object.entries(duplas)) {
      const hora = horarios[patrimonio];
      const operador = dupla[semana % dupla.length];
      const eqNome = equipamentos[patrimonio];
      const horimetro = +(horimetroBase[patrimonio] + diasDesdeInicio * 0.5).toFixed(1);
      const eqLabel = `${eqNome} (${patrimonio})`;
      const timestamp = `${data}T${hora}:00+00:00`;

      const rng = seededRandom(`${data}${patrimonio}`);
      const temNok = rng() < 0.08;
      const itemsNok = [];

      if (temNok) {
        const rng2 = seededRandom(`${data}${patrimonio}nok`);
        const n = Math.floor(rng2() * 2) + 1;
        const shuffled = [...checklist_items].sort(() => rng2() - 0.5);
        itemsNok.push(...shuffled.slice(0, n));
      }

      const statusGeral = itemsNok.length > 0 ? 'NOK' : 'OK';
      const inspId = gerarUUID(`insp_${data}_${patrimonio}`);

      const itens = checklist_items.map((item) => {
        const st = itemsNok.includes(item) ? 'NOK' : 'OK';
        const rngObs = seededRandom(`${data}${patrimonio}${item}`);
        const obs = st === 'NOK' ? observacoesNok[Math.floor(rngObs() * observacoesNok.length)] : '';
        return { itemKey: item.toLowerCase().replace(/ /g,'_'), itemLabel: item, status: st, observacao: obs };
      });

      historicoLote.push({
        id: inspId, created_at: timestamp, data, hora: `${hora}:00`,
        operador, equipamento: eqLabel, patrimonio, horimetro,
        ligando: 'OK', bateria_barras: 4, status_geral: statusGeral,
        itens, observacao_geral: ''
      });
    }

    const { error: e1 } = await supabase.from('historico_inspecoes').upsert(historicoLote, { onConflict: 'id' });
    if (e1) console.error(`Erro historico ${data}:`, e1.message);
    else totalHistorico += historicoLote.length;

    if (dias.indexOf(data) % 20 === 0) {
      console.log(`Progresso: ${data} — ${totalHistorico} inspeções`);
    }
  }

  console.log(`\nConcluído! ${totalHistorico} inspeções inseridas.`);
}

inserir().catch(console.error);