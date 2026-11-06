// Gerado por scripts/gen-bancadas.py. Não editar à mão.
// Fonte: TSE, dados abertos, consulta_cand (candidatos eleitos), arquivos gerados em
// 1994: 13/02/2026, 1998: 25/05/2021, 2002: 25/05/2021, 2006: 27/08/2021, 2010: 19/04/2021, 2014: 23/06/2021, 2018: 13/11/2024, 2022: 06/11/2026, 2026: 06/11/2026.
// Partido do dia da eleição; sem suplentes, trocas de partido nem cassações depois dela.

export type Bancada = Record<string, Record<string, number>>; // UF → partido → cadeiras
export type Legislatura = {
  /** Ano em que a legislatura começa (1º de fevereiro). */
  legislatura: number;
  eleicao: number;
  camara: Bancada;
  /** null: o TSE não tem o arquivo da eleição anterior (1990). */
  senado: Bancada | null;
};

export const LEGISLATURAS: Legislatura[] = [
  {
    "legislatura": 1995,
    "eleicao": 1994,
    "camara": {
      "AC": {
        "PMDB": 4,
        "PP": 1,
        "PPR": 3
      },
      "AL": {
        "PFL": 1,
        "PMDB": 1,
        "PP": 1,
        "PPR": 1,
        "PSC": 1,
        "PSD": 1,
        "PSDB": 2,
        "PTB": 1
      },
      "AM": {
        "PFL": 1,
        "PMDB": 3,
        "PPR": 3,
        "PSDB": 1
      },
      "AP": {
        "PFL": 3,
        "PP": 1,
        "PPR": 1,
        "PSB": 2,
        "PTB": 1
      },
      "BA": {
        "PC DO B": 1,
        "PDT": 3,
        "PFL": 16,
        "PL": 2,
        "PMDB": 6,
        "PP": 1,
        "PPR": 1,
        "PSB": 2,
        "PSDB": 4,
        "PT": 2,
        "PTB": 1
      },
      "CE": {
        "PC DO B": 1,
        "PFL": 2,
        "PMDB": 5,
        "PP": 2,
        "PSDB": 11,
        "PT": 1
      },
      "DF": {
        "PC DO B": 1,
        "PFL": 1,
        "PP": 3,
        "PPS": 1,
        "PT": 2
      },
      "ES": {
        "PDT": 2,
        "PMDB": 3,
        "PSB": 1,
        "PSDB": 2,
        "PT": 1,
        "PTB": 1
      },
      "GO": {
        "PC DO B": 1,
        "PFL": 1,
        "PMDB": 7,
        "PP": 2,
        "PPR": 2,
        "PRN": 1,
        "PSDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "MA": {
        "PDT": 1,
        "PFL": 7,
        "PMDB": 5,
        "PSC": 1,
        "PSDB": 2,
        "PT": 2
      },
      "MG": {
        "PC DO B": 1,
        "PDT": 1,
        "PFL": 10,
        "PL": 1,
        "PMDB": 11,
        "PMN": 1,
        "PP": 6,
        "PPR": 1,
        "PSDB": 8,
        "PT": 6,
        "PTB": 7
      },
      "MS": {
        "PDT": 1,
        "PFL": 1,
        "PMDB": 3,
        "PP": 1,
        "PSDB": 1,
        "PTB": 1
      },
      "MT": {
        "PDT": 1,
        "PL": 1,
        "PMDB": 1,
        "PPR": 1,
        "PSDB": 1,
        "PT": 1,
        "PTB": 2
      },
      "PA": {
        "PC DO B": 1,
        "PDT": 1,
        "PFL": 1,
        "PMDB": 7,
        "PPR": 4,
        "PT": 2,
        "PTB": 1
      },
      "PB": {
        "PDT": 1,
        "PFL": 3,
        "PMDB": 7,
        "PPR": 1
      },
      "PE": {
        "PDT": 2,
        "PFL": 11,
        "PMN": 1,
        "PP": 1,
        "PSB": 7,
        "PSDB": 1,
        "PT": 2
      },
      "PI": {
        "PFL": 5,
        "PMDB": 2,
        "PP": 1,
        "PPR": 2
      },
      "PR": {
        "PC DO B": 1,
        "PDT": 3,
        "PFL": 6,
        "PMDB": 4,
        "PP": 6,
        "PPR": 2,
        "PSDB": 1,
        "PT": 3,
        "PTB": 4
      },
      "RJ": {
        "PC DO B": 2,
        "PDT": 8,
        "PFL": 4,
        "PL": 3,
        "PMDB": 4,
        "PP": 3,
        "PPR": 6,
        "PPS": 1,
        "PSB": 2,
        "PSDB": 6,
        "PT": 3,
        "PTB": 3,
        "PV": 1
      },
      "RN": {
        "PFL": 5,
        "PMDB": 2,
        "PSDB": 1
      },
      "RO": {
        "PDT": 1,
        "PL": 1,
        "PMDB": 1,
        "PP": 2,
        "PSDB": 3
      },
      "RR": {
        "PFL": 1,
        "PPR": 1,
        "PSC": 1,
        "PSDB": 1,
        "PTB": 4
      },
      "RS": {
        "PDT": 5,
        "PFL": 1,
        "PMDB": 8,
        "PPR": 6,
        "PSDB": 2,
        "PT": 7,
        "PTB": 2
      },
      "SC": {
        "PDT": 2,
        "PFL": 3,
        "PMDB": 5,
        "PPR": 4,
        "PT": 2
      },
      "SE": {
        "PFL": 1,
        "PMDB": 2,
        "PMN": 2,
        "PPR": 2,
        "PT": 1
      },
      "SP": {
        "PC DO B": 1,
        "PDT": 2,
        "PFL": 3,
        "PL": 5,
        "PMDB": 14,
        "PP": 1,
        "PPR": 8,
        "PRP": 1,
        "PSB": 1,
        "PSD": 2,
        "PSDB": 15,
        "PT": 14,
        "PTB": 3
      },
      "TO": {
        "PFL": 2,
        "PMDB": 2,
        "PP": 2,
        "PPR": 2
      }
    },
    "senado": null
  },
  {
    "legislatura": 1999,
    "eleicao": 1998,
    "camara": {
      "AC": {
        "PDT": 1,
        "PFL": 3,
        "PMDB": 1,
        "PPB": 1,
        "PT": 2
      },
      "AL": {
        "PFL": 1,
        "PMDB": 1,
        "PMN": 1,
        "PPS": 1,
        "PSB": 1,
        "PSD": 1,
        "PSDB": 2,
        "PTB": 1
      },
      "AM": {
        "PC do B": 1,
        "PFL": 4,
        "PL": 1,
        "PPB": 1,
        "PSDB": 1
      },
      "AP": {
        "PFL": 2,
        "PMDB": 1,
        "PSB": 1,
        "PSDB": 3,
        "PTB": 1
      },
      "BA": {
        "PC do B": 1,
        "PDT": 1,
        "PFL": 20,
        "PL": 1,
        "PMDB": 3,
        "PPB": 1,
        "PSDB": 6,
        "PT": 5,
        "PTB": 1
      },
      "CE": {
        "PC do B": 1,
        "PFL": 1,
        "PMDB": 5,
        "PPB": 1,
        "PSB": 1,
        "PSDB": 12,
        "PT": 1
      },
      "DF": {
        "PC do B": 1,
        "PFL": 1,
        "PMDB": 1,
        "PPB": 2,
        "PSDB": 1,
        "PT": 2
      },
      "ES": {
        "PFL": 1,
        "PMDB": 1,
        "PPB": 1,
        "PSDB": 3,
        "PT": 1,
        "PTB": 3
      },
      "GO": {
        "PFL": 2,
        "PL": 2,
        "PMDB": 8,
        "PPB": 1,
        "PSD": 1,
        "PSDB": 2,
        "PT": 1
      },
      "MA": {
        "PDT": 1,
        "PFL": 6,
        "PL": 2,
        "PMDB": 3,
        "PSB": 1,
        "PSC": 1,
        "PSD": 1,
        "PSDB": 3
      },
      "MG": {
        "PC do B": 1,
        "PDT": 1,
        "PFL": 8,
        "PL": 3,
        "PMDB": 9,
        "PPB": 7,
        "PSDB": 14,
        "PST": 1,
        "PT": 7,
        "PTB": 2
      },
      "MS": {
        "PFL": 1,
        "PMDB": 1,
        "PPB": 1,
        "PSDB": 2,
        "PT": 2,
        "PTB": 1
      },
      "MT": {
        "PFL": 1,
        "PL": 1,
        "PMDB": 2,
        "PSDB": 3,
        "PTB": 1
      },
      "PA": {
        "PDT": 1,
        "PFL": 3,
        "PMDB": 4,
        "PPB": 1,
        "PSDB": 4,
        "PT": 3,
        "PTB": 1
      },
      "PB": {
        "PFL": 3,
        "PMDB": 5,
        "PPB": 1,
        "PSDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "PE": {
        "PFL": 8,
        "PMDB": 3,
        "PPB": 2,
        "PSB": 8,
        "PSDB": 1,
        "PSL": 1,
        "PT": 1,
        "PTB": 1
      },
      "PI": {
        "PFL": 5,
        "PMDB": 3,
        "PSDB": 1,
        "PT": 1
      },
      "PR": {
        "PDT": 1,
        "PFL": 6,
        "PMDB": 4,
        "PPB": 5,
        "PSDB": 5,
        "PT": 3,
        "PTB": 6
      },
      "RJ": {
        "PC do B": 1,
        "PDT": 7,
        "PFL": 9,
        "PMDB": 2,
        "PPB": 6,
        "PSB": 2,
        "PSC": 1,
        "PSDB": 11,
        "PT": 4,
        "PTB": 2,
        "PV": 1
      },
      "RN": {
        "PFL": 3,
        "PMDB": 4,
        "PPB": 1
      },
      "RO": {
        "PDT": 2,
        "PFL": 2,
        "PMDB": 1,
        "PSDB": 2,
        "PTB": 1
      },
      "RR": {
        "PMDB": 1,
        "PPB": 4,
        "PSDB": 2,
        "PTB": 1
      },
      "RS": {
        "PDT": 4,
        "PFL": 1,
        "PMDB": 7,
        "PPB": 5,
        "PSB": 1,
        "PSDB": 2,
        "PT": 8,
        "PTB": 3
      },
      "SC": {
        "PDT": 2,
        "PFL": 3,
        "PMDB": 4,
        "PPB": 4,
        "PSDB": 1,
        "PT": 2
      },
      "SE": {
        "PMDB": 2,
        "PMN": 1,
        "PPB": 1,
        "PPS": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "SP": {
        "PC do B": 1,
        "PDT": 4,
        "PFL": 8,
        "PL": 2,
        "PMDB": 5,
        "PPB": 12,
        "PPS": 1,
        "PRONA": 1,
        "PSB": 2,
        "PSDB": 15,
        "PT": 14,
        "PTB": 5
      },
      "TO": {
        "PFL": 3,
        "PMDB": 2,
        "PPB": 2,
        "PSDB": 1
      }
    },
    "senado": {
      "AC": {
        "PMDB": 1,
        "PT": 2
      },
      "AL": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "AM": {
        "PMDB": 1,
        "PP": 1,
        "PSDB": 1
      },
      "AP": {
        "PDT": 1,
        "PMDB": 2
      },
      "BA": {
        "PFL": 3
      },
      "CE": {
        "PDT": 1,
        "PSDB": 2
      },
      "DF": {
        "PMDB": 1,
        "PP": 1,
        "PT": 1
      },
      "ES": {
        "PMDB": 1,
        "PSDB": 2
      },
      "GO": {
        "PMDB": 3
      },
      "MA": {
        "PFL": 2,
        "PMDB": 1
      },
      "MG": {
        "PFL": 1,
        "PMDB": 1,
        "PTB": 1
      },
      "MS": {
        "PMDB": 2,
        "PSDB": 1
      },
      "MT": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "PA": {
        "PMDB": 1,
        "PPB": 1,
        "PSB": 1
      },
      "PB": {
        "PMDB": 3
      },
      "PE": {
        "PFL": 1,
        "PPS": 1,
        "PSDB": 1
      },
      "PI": {
        "PFL": 2,
        "PMDB": 1
      },
      "PR": {
        "PMDB": 1,
        "PP": 1,
        "PSDB": 1
      },
      "RJ": {
        "PSB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "RN": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "RO": {
        "PDT": 2,
        "PMDB": 1
      },
      "RR": {
        "PPB": 1,
        "PPR": 1,
        "PTB": 1
      },
      "RS": {
        "PMDB": 2,
        "PTB": 1
      },
      "SC": {
        "PFL": 2,
        "PMDB": 1
      },
      "SE": {
        "PFL": 1,
        "PP": 1,
        "PT": 1
      },
      "SP": {
        "PL": 1,
        "PSDB": 1,
        "PT": 1
      },
      "TO": {
        "PFL": 2,
        "PPR": 1
      }
    }
  },
  {
    "legislatura": 2003,
    "eleicao": 2002,
    "camara": {
      "AC": {
        "PC do B": 1,
        "PMDB": 2,
        "PPB": 1,
        "PPS": 1,
        "PT": 3
      },
      "AL": {
        "PFL": 2,
        "PL": 1,
        "PMDB": 1,
        "PSB": 2,
        "PSDB": 1,
        "PTB": 2
      },
      "AM": {
        "PC do B": 1,
        "PFL": 3,
        "PL": 3,
        "PTB": 1
      },
      "AP": {
        "PDT": 2,
        "PPB": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 2,
        "PTB": 1
      },
      "BA": {
        "PC do B": 2,
        "PDT": 1,
        "PFL": 19,
        "PMDB": 3,
        "PPB": 2,
        "PPS": 1,
        "PSDB": 2,
        "PT": 7,
        "PTB": 1,
        "PV": 1
      },
      "CE": {
        "PC do B": 1,
        "PFL": 2,
        "PL": 2,
        "PMDB": 5,
        "PPB": 1,
        "PPS": 1,
        "PSDB": 8,
        "PT": 2
      },
      "DF": {
        "PC do B": 1,
        "PFL": 1,
        "PMDB": 3,
        "PSD": 1,
        "PT": 2
      },
      "ES": {
        "PDT": 1,
        "PL": 1,
        "PMDB": 1,
        "PPB": 2,
        "PSB": 1,
        "PSDB": 2,
        "PT": 1,
        "PTB": 1
      },
      "GO": {
        "PFL": 3,
        "PMDB": 4,
        "PPB": 3,
        "PSDB": 5,
        "PT": 2
      },
      "MA": {
        "PDT": 3,
        "PFL": 7,
        "PL": 1,
        "PMDB": 2,
        "PPB": 1,
        "PSB": 1,
        "PSDB": 2,
        "PT": 1
      },
      "MG": {
        "PC do B": 1,
        "PDT": 2,
        "PFL": 7,
        "PL": 4,
        "PMDB": 6,
        "PPB": 4,
        "PPS": 3,
        "PSB": 1,
        "PSDB": 8,
        "PSL": 1,
        "PST": 2,
        "PT": 11,
        "PTB": 2,
        "PV": 1
      },
      "MS": {
        "PFL": 1,
        "PMDB": 2,
        "PPS": 1,
        "PT": 3,
        "PTB": 1
      },
      "MT": {
        "PFL": 1,
        "PL": 1,
        "PMDB": 1,
        "PPB": 1,
        "PSDB": 3,
        "PT": 1
      },
      "PA": {
        "PDT": 1,
        "PFL": 1,
        "PL": 1,
        "PMDB": 5,
        "PPB": 1,
        "PSDB": 4,
        "PT": 3,
        "PTB": 1
      },
      "PB": {
        "PFL": 1,
        "PL": 1,
        "PMDB": 2,
        "PPB": 1,
        "PSD": 1,
        "PSDB": 3,
        "PT": 1,
        "PTB": 2
      },
      "PE": {
        "PC do B": 1,
        "PFL": 5,
        "PL": 1,
        "PMDB": 4,
        "PPB": 3,
        "PPS": 1,
        "PSB": 4,
        "PSDB": 3,
        "PT": 3
      },
      "PI": {
        "PC do B": 1,
        "PFL": 4,
        "PMDB": 2,
        "PSDB": 2,
        "PT": 1
      },
      "PR": {
        "PDT": 1,
        "PFL": 2,
        "PL": 1,
        "PMDB": 6,
        "PPB": 4,
        "PPS": 2,
        "PSDB": 5,
        "PT": 6,
        "PTB": 3
      },
      "RJ": {
        "PC do B": 1,
        "PDT": 3,
        "PFL": 4,
        "PL": 3,
        "PMDB": 6,
        "PPB": 6,
        "PSB": 6,
        "PSC": 1,
        "PSD": 1,
        "PSDB": 5,
        "PSDC": 1,
        "PT": 7,
        "PTB": 1,
        "PV": 1
      },
      "RN": {
        "PFL": 2,
        "PMDB": 3,
        "PPB": 1,
        "PT": 1,
        "PTB": 1
      },
      "RO": {
        "PFL": 1,
        "PMDB": 2,
        "PPS": 1,
        "PSDB": 1,
        "PT": 2,
        "PTB": 1
      },
      "RR": {
        "PDT": 2,
        "PFL": 3,
        "PL": 1,
        "PPB": 1,
        "PST": 1
      },
      "RS": {
        "PDT": 3,
        "PFL": 1,
        "PL": 1,
        "PMDB": 6,
        "PPB": 6,
        "PPS": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 8,
        "PTB": 3
      },
      "SC": {
        "PDT": 1,
        "PFL": 2,
        "PMDB": 4,
        "PPB": 4,
        "PT": 5
      },
      "SE": {
        "PFL": 2,
        "PL": 1,
        "PMDB": 1,
        "PMN": 1,
        "PPB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "SP": {
        "PC do B": 2,
        "PDT": 1,
        "PFL": 7,
        "PL": 3,
        "PMDB": 4,
        "PPB": 3,
        "PPS": 3,
        "PRONA": 6,
        "PSB": 5,
        "PSDB": 11,
        "PT": 18,
        "PTB": 5,
        "PV": 2
      },
      "TO": {
        "PFL": 3,
        "PMDB": 1,
        "PPB": 1,
        "PSD": 1,
        "PSDB": 2
      }
    },
    "senado": {
      "AC": {
        "PSB": 1,
        "PT": 2
      },
      "AL": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "AM": {
        "PDT": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "AP": {
        "PMDB": 1,
        "PSB": 1,
        "PTB": 1
      },
      "BA": {
        "PFL": 3
      },
      "CE": {
        "PPS": 1,
        "PSDB": 2
      },
      "DF": {
        "PFL": 1,
        "PMDB": 1,
        "PT": 1
      },
      "ES": {
        "PL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "GO": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "MA": {
        "PFL": 2,
        "PMDB": 1
      },
      "MG": {
        "PMDB": 2,
        "PSDB": 1
      },
      "MS": {
        "PMDB": 2,
        "PT": 1
      },
      "MT": {
        "PFL": 1,
        "PSDB": 1,
        "PT": 1
      },
      "PA": {
        "PPB": 1,
        "PSD": 1,
        "PT": 1
      },
      "PB": {
        "PFL": 1,
        "PMDB": 2
      },
      "PE": {
        "PFL": 2,
        "PSDB": 1
      },
      "PI": {
        "PFL": 1,
        "PMDB": 2
      },
      "PR": {
        "PDT": 1,
        "PSDB": 1,
        "PT": 1
      },
      "RJ": {
        "PL": 1,
        "PMDB": 1,
        "PSB": 1
      },
      "RN": {
        "PFL": 1,
        "PMDB": 2
      },
      "RO": {
        "PMDB": 2,
        "PT": 1
      },
      "RR": {
        "PDT": 1,
        "PPB": 1,
        "PSDB": 1
      },
      "RS": {
        "PMDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "SC": {
        "PFL": 1,
        "PSDB": 1,
        "PT": 1
      },
      "SE": {
        "PDT": 1,
        "PFL": 1,
        "PSB": 1
      },
      "SP": {
        "PFL": 1,
        "PT": 2
      },
      "TO": {
        "PFL": 3
      }
    }
  },
  {
    "legislatura": 2007,
    "eleicao": 2006,
    "camara": {
      "AC": {
        "PC do B": 1,
        "PMDB": 1,
        "PMN": 1,
        "PP": 1,
        "PPS": 1,
        "PT": 3
      },
      "AL": {
        "PDT": 1,
        "PFL": 2,
        "PMDB": 3,
        "PMN": 1,
        "PP": 1,
        "PSB": 1
      },
      "AM": {
        "PC do B": 1,
        "PFL": 1,
        "PMDB": 1,
        "PP": 2,
        "PSB": 1,
        "PT": 1,
        "PTB": 1
      },
      "AP": {
        "PC do B": 1,
        "PDT": 1,
        "PFL": 1,
        "PMDB": 2,
        "PPS": 1,
        "PSB": 1,
        "PT": 1
      },
      "BA": {
        "PC do B": 2,
        "PDT": 3,
        "PFL": 13,
        "PL": 3,
        "PMDB": 1,
        "PP": 3,
        "PPS": 2,
        "PSB": 1,
        "PSDB": 2,
        "PT": 8,
        "PV": 1
      },
      "CE": {
        "PC do B": 1,
        "PL": 1,
        "PMDB": 6,
        "PP": 2,
        "PSB": 2,
        "PSDB": 5,
        "PT": 4,
        "PTB": 1
      },
      "DF": {
        "PFL": 2,
        "PMDB": 2,
        "PPS": 1,
        "PSB": 1,
        "PT": 1,
        "PTB": 1
      },
      "ES": {
        "PDT": 2,
        "PL": 1,
        "PMDB": 4,
        "PSC": 1,
        "PSDB": 1,
        "PT": 1
      },
      "GO": {
        "PFL": 1,
        "PL": 1,
        "PMDB": 5,
        "PP": 2,
        "PSDB": 4,
        "PT": 2,
        "PTB": 2
      },
      "MA": {
        "PAN": 1,
        "PC do B": 1,
        "PDT": 2,
        "PFL": 2,
        "PMDB": 3,
        "PSB": 2,
        "PSDB": 4,
        "PT": 1,
        "PTB": 1,
        "PV": 1
      },
      "MG": {
        "PC do B": 1,
        "PDT": 2,
        "PFL": 6,
        "PHS": 1,
        "PL": 6,
        "PMDB": 7,
        "PP": 3,
        "PPS": 4,
        "PSB": 1,
        "PSC": 1,
        "PSDB": 7,
        "PT": 9,
        "PTC": 1,
        "PV": 4
      },
      "MS": {
        "PDT": 1,
        "PMDB": 2,
        "PP": 1,
        "PPS": 1,
        "PSDB": 1,
        "PT": 2
      },
      "MT": {
        "PL": 1,
        "PMDB": 1,
        "PP": 2,
        "PPS": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "PA": {
        "PDT": 1,
        "PFL": 2,
        "PMDB": 6,
        "PP": 1,
        "PSC": 1,
        "PSDB": 3,
        "PT": 3
      },
      "PB": {
        "PFL": 1,
        "PL": 2,
        "PMDB": 3,
        "PSB": 2,
        "PSDB": 3,
        "PT": 1
      },
      "PE": {
        "PC do B": 1,
        "PDT": 1,
        "PFL": 3,
        "PL": 1,
        "PMDB": 3,
        "PP": 1,
        "PPS": 1,
        "PSB": 3,
        "PSC": 1,
        "PSDB": 2,
        "PT": 5,
        "PTB": 3
      },
      "PI": {
        "PC do B": 1,
        "PFL": 2,
        "PMDB": 2,
        "PP": 1,
        "PSDB": 1,
        "PT": 2,
        "PTB": 1
      },
      "PR": {
        "PDT": 1,
        "PFL": 5,
        "PL": 2,
        "PMDB": 8,
        "PP": 3,
        "PPS": 2,
        "PSDB": 4,
        "PT": 4,
        "PTB": 1
      },
      "RJ": {
        "PC do B": 1,
        "PDT": 3,
        "PFL": 5,
        "PHS": 1,
        "PL": 1,
        "PMDB": 10,
        "PP": 2,
        "PPS": 3,
        "PRB": 1,
        "PRONA": 1,
        "PSB": 1,
        "PSC": 3,
        "PSDB": 3,
        "PSOL": 1,
        "PT": 6,
        "PT do B": 1,
        "PTB": 2,
        "PV": 1
      },
      "RN": {
        "PFL": 1,
        "PL": 1,
        "PMDB": 1,
        "PMN": 1,
        "PP": 1,
        "PSB": 2,
        "PT": 1
      },
      "RO": {
        "PMDB": 2,
        "PPS": 1,
        "PSB": 1,
        "PT": 2,
        "PTB": 1,
        "PV": 1
      },
      "RR": {
        "PFL": 2,
        "PL": 1,
        "PMDB": 1,
        "PP": 1,
        "PSB": 1,
        "PSDB": 1,
        "PTC": 1
      },
      "RS": {
        "PC do B": 1,
        "PDT": 3,
        "PFL": 2,
        "PMDB": 5,
        "PP": 5,
        "PPS": 1,
        "PSB": 1,
        "PSDB": 2,
        "PSOL": 1,
        "PT": 7,
        "PTB": 3
      },
      "SC": {
        "PFL": 3,
        "PMDB": 5,
        "PP": 3,
        "PPS": 1,
        "PSDB": 1,
        "PT": 3
      },
      "SE": {
        "PFL": 3,
        "PSB": 1,
        "PSC": 1,
        "PSDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "SP": {
        "PC do B": 1,
        "PDT": 3,
        "PFL": 5,
        "PL": 2,
        "PMDB": 3,
        "PP": 5,
        "PPS": 2,
        "PRONA": 1,
        "PSB": 4,
        "PSC": 1,
        "PSDB": 18,
        "PSOL": 1,
        "PT": 14,
        "PTB": 4,
        "PTC": 1,
        "PV": 5
      },
      "TO": {
        "PFL": 3,
        "PMDB": 2,
        "PP": 1,
        "PSDB": 2
      }
    },
    "senado": {
      "AC": {
        "PSB": 1,
        "PT": 2
      },
      "AL": {
        "PMDB": 1,
        "PRTB": 1,
        "PSDB": 1
      },
      "AM": {
        "PDT": 1,
        "PL": 1,
        "PSDB": 1
      },
      "AP": {
        "PMDB": 1,
        "PSB": 1,
        "PTB": 1
      },
      "BA": {
        "PDT": 1,
        "PFL": 2
      },
      "CE": {
        "PC do B": 1,
        "PPS": 1,
        "PSDB": 1
      },
      "DF": {
        "PFL": 1,
        "PMDB": 1,
        "PT": 1
      },
      "ES": {
        "PL": 1,
        "PMDB": 1,
        "PSB": 1
      },
      "GO": {
        "PFL": 1,
        "PSDB": 2
      },
      "MA": {
        "PFL": 2,
        "PTB": 1
      },
      "MG": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "MS": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "MT": {
        "PFL": 2,
        "PT": 1
      },
      "PA": {
        "PSD": 1,
        "PSDB": 1,
        "PT": 1
      },
      "PB": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "PE": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "PI": {
        "PFL": 1,
        "PMDB": 1,
        "PTB": 1
      },
      "PR": {
        "PDT": 1,
        "PSDB": 1,
        "PT": 1
      },
      "RJ": {
        "PL": 1,
        "PMDB": 1,
        "PP": 1
      },
      "RN": {
        "PFL": 2,
        "PMDB": 1
      },
      "RO": {
        "PMDB": 1,
        "PPS": 1,
        "PT": 1
      },
      "RR": {
        "PDT": 1,
        "PSDB": 1,
        "PTB": 1
      },
      "RS": {
        "PMDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "SC": {
        "PFL": 1,
        "PSDB": 1,
        "PT": 1
      },
      "SE": {
        "PDT": 1,
        "PFL": 1,
        "PSB": 1
      },
      "SP": {
        "PFL": 1,
        "PT": 2
      },
      "TO": {
        "PFL": 3
      }
    }
  },
  {
    "legislatura": 2011,
    "eleicao": 2010,
    "camara": {
      "AC": {
        "PC do B": 1,
        "PMDB": 1,
        "PP": 1,
        "PSC": 1,
        "PSDB": 1,
        "PT": 2,
        "PV": 1
      },
      "AL": {
        "PMDB": 2,
        "PP": 1,
        "PR": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT do B": 1,
        "PTB": 2
      },
      "AM": {
        "DEM": 1,
        "PMDB": 1,
        "PP": 2,
        "PR": 1,
        "PSC": 1,
        "PT": 1,
        "PTB": 1
      },
      "AP": {
        "DEM": 1,
        "PC do B": 1,
        "PDT": 1,
        "PMDB": 1,
        "PRTB": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "BA": {
        "DEM": 6,
        "PC do B": 3,
        "PDT": 4,
        "PMDB": 2,
        "PP": 4,
        "PR": 3,
        "PRB": 1,
        "PRP": 1,
        "PSC": 2,
        "PSDB": 2,
        "PT": 10,
        "PTB": 1
      },
      "CE": {
        "PC do B": 2,
        "PDT": 1,
        "PMDB": 5,
        "PP": 1,
        "PR": 2,
        "PSB": 4,
        "PSDB": 2,
        "PT": 4,
        "PTB": 1
      },
      "DF": {
        "PDT": 1,
        "PMDB": 1,
        "PMN": 1,
        "PR": 2,
        "PT": 3
      },
      "ES": {
        "PDT": 3,
        "PMDB": 2,
        "PSB": 2,
        "PSC": 1,
        "PSDB": 1,
        "PT": 1
      },
      "GO": {
        "DEM": 3,
        "PDT": 1,
        "PMDB": 4,
        "PMN": 1,
        "PP": 2,
        "PR": 1,
        "PSDB": 3,
        "PT": 1,
        "PTB": 1
      },
      "MA": {
        "DEM": 1,
        "PMDB": 5,
        "PP": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSDB": 3,
        "PT": 1,
        "PT do B": 1,
        "PTB": 1,
        "PTC": 1,
        "PV": 1
      },
      "MG": {
        "DEM": 3,
        "PC do B": 1,
        "PDT": 2,
        "PHS": 1,
        "PMDB": 7,
        "PMN": 1,
        "PP": 5,
        "PPS": 2,
        "PR": 7,
        "PRB": 1,
        "PSB": 1,
        "PSC": 1,
        "PSDB": 8,
        "PSL": 1,
        "PT": 8,
        "PT do B": 1,
        "PTB": 1,
        "PV": 2
      },
      "MS": {
        "DEM": 1,
        "PMDB": 3,
        "PR": 1,
        "PSDB": 1,
        "PT": 2
      },
      "MT": {
        "DEM": 1,
        "PMDB": 1,
        "PP": 2,
        "PR": 2,
        "PSB": 1,
        "PSDB": 1
      },
      "PA": {
        "DEM": 1,
        "PDT": 1,
        "PMDB": 4,
        "PPS": 1,
        "PR": 1,
        "PSC": 1,
        "PSDB": 3,
        "PT": 4,
        "PTB": 1
      },
      "PB": {
        "DEM": 1,
        "PDT": 1,
        "PMDB": 5,
        "PP": 1,
        "PR": 1,
        "PSDB": 2,
        "PT": 1
      },
      "PE": {
        "DEM": 2,
        "PC do B": 1,
        "PDT": 1,
        "PMDB": 1,
        "PP": 2,
        "PR": 2,
        "PSB": 5,
        "PSC": 1,
        "PSDB": 2,
        "PT": 4,
        "PTB": 4
      },
      "PI": {
        "DEM": 2,
        "PC do B": 1,
        "PMDB": 2,
        "PP": 1,
        "PSB": 1,
        "PT": 2,
        "PTB": 1
      },
      "PR": {
        "DEM": 2,
        "PMDB": 6,
        "PP": 3,
        "PPS": 3,
        "PR": 1,
        "PSB": 1,
        "PSC": 4,
        "PSDB": 3,
        "PT": 5,
        "PTB": 1,
        "PV": 1
      },
      "RJ": {
        "DEM": 2,
        "PC do B": 1,
        "PDT": 3,
        "PHS": 1,
        "PMDB": 8,
        "PP": 3,
        "PPS": 1,
        "PR": 8,
        "PRB": 1,
        "PRTB": 1,
        "PSB": 3,
        "PSC": 2,
        "PSDB": 2,
        "PSOL": 2,
        "PT": 5,
        "PTB": 1,
        "PV": 2
      },
      "RN": {
        "DEM": 2,
        "PMDB": 1,
        "PMN": 1,
        "PR": 1,
        "PSB": 1,
        "PT": 1,
        "PV": 1
      },
      "RO": {
        "PDT": 1,
        "PMDB": 2,
        "PP": 1,
        "PPS": 1,
        "PSB": 1,
        "PT": 1,
        "PTB": 1
      },
      "RR": {
        "DEM": 1,
        "PMDB": 2,
        "PP": 1,
        "PR": 1,
        "PRB": 1,
        "PRP": 1,
        "PSDB": 1
      },
      "RS": {
        "DEM": 1,
        "PC do B": 2,
        "PDT": 3,
        "PMDB": 4,
        "PP": 6,
        "PSB": 3,
        "PSDB": 1,
        "PT": 8,
        "PTB": 3
      },
      "SC": {
        "DEM": 3,
        "PMDB": 5,
        "PP": 2,
        "PSDB": 2,
        "PT": 4
      },
      "SE": {
        "DEM": 1,
        "PMDB": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSC": 1,
        "PT": 2
      },
      "SP": {
        "DEM": 6,
        "PC do B": 2,
        "PDT": 3,
        "PMDB": 1,
        "PP": 4,
        "PPS": 3,
        "PR": 4,
        "PRB": 2,
        "PSB": 7,
        "PSC": 2,
        "PSDB": 13,
        "PSOL": 1,
        "PT": 15,
        "PTB": 2,
        "PV": 5
      },
      "TO": {
        "DEM": 2,
        "PDT": 1,
        "PMDB": 1,
        "PP": 1,
        "PPS": 1,
        "PSB": 1,
        "PSDB": 1
      }
    },
    "senado": {
      "AC": {
        "PMN": 1,
        "PT": 2
      },
      "AL": {
        "PMDB": 1,
        "PP": 1,
        "PRTB": 1
      },
      "AM": {
        "PC do B": 1,
        "PL": 1,
        "PMDB": 1
      },
      "AP": {
        "PMDB": 1,
        "PSB": 1,
        "PSOL": 1
      },
      "BA": {
        "PDT": 1,
        "PSB": 1,
        "PT": 1
      },
      "CE": {
        "PC do B": 1,
        "PMDB": 1,
        "PT": 1
      },
      "DF": {
        "PDT": 1,
        "PMDB": 1,
        "PSB": 1
      },
      "ES": {
        "PMDB": 1,
        "PR": 1,
        "PSB": 1
      },
      "GO": {
        "DEM": 1,
        "PSDB": 2
      },
      "MA": {
        "PMDB": 2,
        "PTB": 1
      },
      "MG": {
        "PFL": 1,
        "PPS": 1,
        "PSDB": 1
      },
      "MS": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "MT": {
        "PDT": 1,
        "PFL": 1,
        "PR": 1
      },
      "PA": {
        "PMDB": 1,
        "PSDB": 2
      },
      "PB": {
        "PMDB": 1,
        "PSDB": 2
      },
      "PE": {
        "PMDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "PI": {
        "PP": 1,
        "PT": 1,
        "PTB": 1
      },
      "PR": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "RJ": {
        "PP": 1,
        "PRB": 1,
        "PT": 1
      },
      "RN": {
        "DEM": 1,
        "PFL": 1,
        "PMDB": 1
      },
      "RO": {
        "PMDB": 1,
        "PP": 1,
        "PPS": 1
      },
      "RR": {
        "PMDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "RS": {
        "PMDB": 1,
        "PP": 1,
        "PT": 1
      },
      "SC": {
        "PFL": 1,
        "PMDB": 1,
        "PSDB": 1
      },
      "SE": {
        "PFL": 1,
        "PSB": 1,
        "PSC": 1
      },
      "SP": {
        "PSDB": 1,
        "PT": 2
      },
      "TO": {
        "PFL": 1,
        "PR": 2
      }
    }
  },
  {
    "legislatura": 2015,
    "eleicao": 2014,
    "camara": {
      "AC": {
        "PMDB": 2,
        "PRB": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 3
      },
      "AL": {
        "PDT": 1,
        "PMDB": 1,
        "PP": 1,
        "PR": 1,
        "PROS": 1,
        "PRTB": 1,
        "PSDB": 1,
        "PT": 1,
        "SD": 1
      },
      "AM": {
        "DEM": 1,
        "PMDB": 1,
        "PP": 1,
        "PPS": 1,
        "PR": 1,
        "PSD": 2,
        "PSDB": 1
      },
      "AP": {
        "PDT": 1,
        "PMDB": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSC": 1,
        "PT": 1,
        "PTB": 1
      },
      "BA": {
        "DEM": 4,
        "PC do B": 2,
        "PDT": 1,
        "PMDB": 1,
        "PP": 4,
        "PR": 2,
        "PRB": 2,
        "PSB": 1,
        "PSC": 2,
        "PSD": 4,
        "PSDB": 3,
        "PT": 8,
        "PTB": 2,
        "PTC": 1,
        "PTN": 1,
        "SD": 1
      },
      "CE": {
        "DEM": 1,
        "PC do B": 1,
        "PDT": 1,
        "PHS": 1,
        "PMDB": 3,
        "PPS": 1,
        "PR": 2,
        "PRB": 1,
        "PROS": 3,
        "PSDB": 1,
        "PSL": 1,
        "PT": 4,
        "PTB": 1,
        "SD": 1
      },
      "DF": {
        "DEM": 1,
        "PMDB": 1,
        "PR": 1,
        "PROS": 1,
        "PSD": 1,
        "PSDB": 1,
        "PT": 1,
        "SD": 1
      },
      "ES": {
        "PDT": 1,
        "PMDB": 1,
        "PP": 1,
        "PROS": 1,
        "PSB": 1,
        "PSDB": 1,
        "PT": 2,
        "PV": 1,
        "SD": 1
      },
      "GO": {
        "PDT": 1,
        "PMDB": 2,
        "PP": 1,
        "PPS": 1,
        "PR": 1,
        "PSD": 2,
        "PSDB": 6,
        "PT": 1,
        "PTB": 1,
        "SD": 1
      },
      "MA": {
        "PATRIOTA": 2,
        "PC do B": 1,
        "PDT": 2,
        "PMDB": 2,
        "PP": 1,
        "PPS": 1,
        "PRB": 1,
        "PRP": 1,
        "PSB": 1,
        "PSDB": 1,
        "PSDC": 1,
        "PT": 1,
        "PTB": 1,
        "PV": 2
      },
      "MG": {
        "DEM": 2,
        "PC do B": 1,
        "PDT": 2,
        "PHS": 1,
        "PMDB": 6,
        "PMN": 1,
        "PP": 5,
        "PR": 3,
        "PRB": 1,
        "PRP": 1,
        "PSB": 3,
        "PSC": 1,
        "PSD": 3,
        "PSDB": 7,
        "PT": 10,
        "PT do B": 1,
        "PTB": 1,
        "PTC": 1,
        "PTN": 1,
        "PV": 1,
        "SD": 1
      },
      "MS": {
        "DEM": 1,
        "PDT": 1,
        "PMDB": 2,
        "PSB": 1,
        "PSDB": 1,
        "PT": 2
      },
      "MT": {
        "PMDB": 1,
        "PP": 1,
        "PROS": 1,
        "PSB": 2,
        "PSC": 1,
        "PSDB": 1,
        "PT": 1
      },
      "PA": {
        "DEM": 1,
        "PMDB": 3,
        "PPS": 1,
        "PR": 1,
        "PROS": 1,
        "PSC": 1,
        "PSD": 3,
        "PSDB": 1,
        "PSOL": 1,
        "PT": 2,
        "PTB": 1,
        "SD": 1
      },
      "PB": {
        "DEM": 1,
        "PDT": 1,
        "PMDB": 3,
        "PP": 1,
        "PR": 1,
        "PSD": 1,
        "PSDB": 1,
        "PT": 1,
        "PTB": 1,
        "SD": 1
      },
      "PE": {
        "DEM": 1,
        "PC do B": 1,
        "PDT": 1,
        "PHS": 1,
        "PMDB": 1,
        "PP": 1,
        "PR": 2,
        "PSB": 8,
        "PSC": 1,
        "PSD": 1,
        "PSDB": 3,
        "PTB": 4
      },
      "PI": {
        "PMDB": 1,
        "PP": 1,
        "PSB": 3,
        "PSD": 1,
        "PT": 2,
        "PTB": 2
      },
      "PR": {
        "PC do B": 1,
        "PHS": 1,
        "PMDB": 4,
        "PP": 4,
        "PPS": 2,
        "PR": 2,
        "PSB": 2,
        "PSC": 2,
        "PSD": 1,
        "PSDB": 3,
        "PT": 4,
        "PTB": 1,
        "PTN": 1,
        "PV": 1,
        "SD": 1
      },
      "RJ": {
        "DEM": 1,
        "PC do B": 1,
        "PDT": 1,
        "PMDB": 8,
        "PP": 3,
        "PR": 6,
        "PRB": 2,
        "PROS": 2,
        "PRP": 1,
        "PSB": 1,
        "PSD": 6,
        "PSDB": 1,
        "PSDC": 1,
        "PSOL": 3,
        "PT": 5,
        "PTB": 2,
        "SD": 2
      },
      "RN": {
        "DEM": 1,
        "PMDB": 1,
        "PMN": 1,
        "PP": 1,
        "PR": 1,
        "PROS": 1,
        "PSD": 1,
        "PSDB": 1
      },
      "RO": {
        "PDT": 1,
        "PMDB": 3,
        "PR": 1,
        "PSDB": 1,
        "PTB": 1,
        "SD": 1
      },
      "RR": {
        "PDT": 1,
        "PHS": 1,
        "PMDB": 1,
        "PMN": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSDB": 1
      },
      "RS": {
        "DEM": 1,
        "PC do B": 1,
        "PDT": 3,
        "PMDB": 5,
        "PP": 6,
        "PRB": 1,
        "PSB": 2,
        "PSD": 1,
        "PSDB": 1,
        "PT": 7,
        "PTB": 3
      },
      "SC": {
        "PMDB": 5,
        "PP": 2,
        "PPS": 1,
        "PR": 1,
        "PSD": 3,
        "PSDB": 2,
        "PT": 2
      },
      "SE": {
        "PMDB": 1,
        "PRB": 1,
        "PSB": 1,
        "PSC": 1,
        "PSD": 1,
        "PT": 1,
        "PTB": 1,
        "SD": 1
      },
      "SP": {
        "DEM": 4,
        "PC do B": 1,
        "PDT": 1,
        "PMDB": 2,
        "PP": 3,
        "PPS": 2,
        "PR": 6,
        "PRB": 8,
        "PSB": 4,
        "PSC": 3,
        "PSD": 4,
        "PSDB": 14,
        "PSOL": 1,
        "PT": 10,
        "PTB": 2,
        "PTN": 1,
        "PV": 3,
        "SD": 1
      },
      "TO": {
        "DEM": 1,
        "PMDB": 3,
        "PP": 1,
        "PRB": 1,
        "PSB": 1,
        "PSD": 1
      }
    },
    "senado": {
      "AC": {
        "PMN": 1,
        "PP": 1,
        "PT": 1
      },
      "AL": {
        "PMDB": 1,
        "PP": 1,
        "PTB": 1
      },
      "AM": {
        "PC do B": 1,
        "PMDB": 1,
        "PSD": 1
      },
      "AP": {
        "DEM": 1,
        "PSB": 1,
        "PSOL": 1
      },
      "BA": {
        "PSB": 1,
        "PSD": 1,
        "PT": 1
      },
      "CE": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "DF": {
        "PDT": 2,
        "PSB": 1
      },
      "ES": {
        "PMDB": 2,
        "PR": 1
      },
      "GO": {
        "DEM": 2,
        "PSDB": 1
      },
      "MA": {
        "PMDB": 2,
        "PSB": 1
      },
      "MG": {
        "PPS": 1,
        "PSDB": 2
      },
      "MS": {
        "PMDB": 2,
        "PT": 1
      },
      "MT": {
        "PDT": 1,
        "PR": 2
      },
      "PA": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "PB": {
        "PMDB": 2,
        "PSDB": 1
      },
      "PE": {
        "PSB": 1,
        "PT": 1,
        "PTB": 1
      },
      "PI": {
        "PP": 1,
        "PT": 1,
        "PTB": 1
      },
      "PR": {
        "PMDB": 1,
        "PSDB": 1,
        "PT": 1
      },
      "RJ": {
        "PRB": 1,
        "PSB": 1,
        "PT": 1
      },
      "RN": {
        "DEM": 1,
        "PMDB": 1,
        "PT": 1
      },
      "RO": {
        "PDT": 1,
        "PMDB": 1,
        "PP": 1
      },
      "RR": {
        "PDT": 1,
        "PMDB": 1,
        "PT": 1
      },
      "RS": {
        "PDT": 1,
        "PP": 1,
        "PT": 1
      },
      "SC": {
        "PMDB": 2,
        "PSDB": 1
      },
      "SE": {
        "DEM": 1,
        "PSB": 1,
        "PSC": 1
      },
      "SP": {
        "PSDB": 2,
        "PT": 1
      },
      "TO": {
        "PMDB": 1,
        "PR": 2
      }
    }
  },
  {
    "legislatura": 2019,
    "eleicao": 2018,
    "camara": {
      "AC": {
        "DEM": 1,
        "MDB": 2,
        "PC do B": 1,
        "PDT": 1,
        "PSDB": 1,
        "PT": 1,
        "SOLIDARIEDADE": 1
      },
      "AL": {
        "MDB": 1,
        "PP": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSD": 1,
        "PSDB": 1,
        "PT": 1,
        "PTB": 1
      },
      "AM": {
        "PP": 1,
        "PR": 1,
        "PRB": 2,
        "PSD": 1,
        "PSL": 1,
        "PT": 1,
        "SOLIDARIEDADE": 1
      },
      "AP": {
        "AVANTE": 1,
        "PC do B": 1,
        "PP": 1,
        "PR": 1,
        "PRB": 1,
        "PROS": 1,
        "PSB": 1,
        "PSDB": 1
      },
      "BA": {
        "AVANTE": 2,
        "DEM": 4,
        "PC do B": 2,
        "PDT": 2,
        "PHS": 2,
        "PODE": 1,
        "PP": 4,
        "PPL": 1,
        "PR": 2,
        "PRB": 2,
        "PRP": 1,
        "PSB": 2,
        "PSD": 5,
        "PSDB": 1,
        "PSL": 1,
        "PT": 7
      },
      "CE": {
        "MDB": 1,
        "PATRIOTA": 1,
        "PDT": 6,
        "PP": 1,
        "PR": 1,
        "PROS": 2,
        "PSB": 1,
        "PSD": 1,
        "PSDB": 1,
        "PSL": 1,
        "PT": 3,
        "PTB": 1,
        "PV": 1,
        "SOLIDARIEDADE": 1
      },
      "DF": {
        "DEM": 1,
        "PP": 1,
        "PPS": 1,
        "PR": 1,
        "PRB": 1,
        "PRP": 1,
        "PT": 1,
        "PV": 1
      },
      "ES": {
        "DEM": 1,
        "PDT": 1,
        "PP": 1,
        "PPS": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 2,
        "PSL": 1,
        "PT": 1
      },
      "GO": {
        "DEM": 2,
        "PDT": 1,
        "PODE": 1,
        "PP": 2,
        "PR": 1,
        "PRB": 1,
        "PRP": 1,
        "PSB": 1,
        "PSC": 1,
        "PSD": 1,
        "PSDB": 1,
        "PSL": 2,
        "PT": 1,
        "SOLIDARIEDADE": 1
      },
      "MA": {
        "DEM": 1,
        "MDB": 2,
        "PATRIOTA": 1,
        "PC do B": 2,
        "PDT": 1,
        "PMN": 2,
        "PODE": 1,
        "PP": 1,
        "PR": 2,
        "PRB": 1,
        "PSB": 1,
        "PSD": 1,
        "PT": 1,
        "PTB": 1
      },
      "MG": {
        "AVANTE": 3,
        "DEM": 1,
        "MDB": 4,
        "NOVO": 2,
        "PATRIOTA": 2,
        "PDT": 2,
        "PHS": 2,
        "PMN": 1,
        "PODE": 1,
        "PP": 2,
        "PR": 1,
        "PRB": 2,
        "PROS": 2,
        "PSB": 3,
        "PSC": 1,
        "PSD": 3,
        "PSDB": 5,
        "PSL": 6,
        "PSOL": 1,
        "PT": 8,
        "SOLIDARIEDADE": 1
      },
      "MS": {
        "DEM": 1,
        "PDT": 1,
        "PSD": 1,
        "PSDB": 2,
        "PSL": 2,
        "PT": 1
      },
      "MT": {
        "MDB": 2,
        "PODE": 1,
        "PSDB": 1,
        "PSL": 1,
        "PT": 1,
        "PTB": 1,
        "SOLIDARIEDADE": 1
      },
      "PA": {
        "DEM": 2,
        "MDB": 2,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSD": 3,
        "PSDB": 2,
        "PSOL": 1,
        "PT": 2,
        "PTB": 2
      },
      "PB": {
        "DEM": 1,
        "PDT": 1,
        "PP": 1,
        "PR": 1,
        "PRB": 1,
        "PSB": 1,
        "PSDB": 3,
        "PSL": 1,
        "PT": 1,
        "PTB": 1
      },
      "PE": {
        "DEM": 1,
        "MDB": 1,
        "PATRIOTA": 1,
        "PC do B": 1,
        "PDT": 2,
        "PHS": 1,
        "PODE": 1,
        "PP": 2,
        "PPS": 1,
        "PR": 1,
        "PRB": 2,
        "PSB": 5,
        "PSC": 1,
        "PSD": 1,
        "PSL": 1,
        "PT": 2,
        "SOLIDARIEDADE": 1
      },
      "PI": {
        "MDB": 1,
        "PDT": 1,
        "PP": 2,
        "PR": 1,
        "PSB": 1,
        "PSD": 1,
        "PT": 2,
        "PTC": 1
      },
      "PR": {
        "DEM": 1,
        "MDB": 2,
        "PDT": 1,
        "PODE": 1,
        "PP": 2,
        "PPS": 1,
        "PR": 3,
        "PRB": 2,
        "PROS": 2,
        "PSB": 2,
        "PSC": 1,
        "PSD": 4,
        "PSL": 3,
        "PT": 3,
        "PTB": 1,
        "PV": 1
      },
      "RJ": {
        "AVANTE": 1,
        "DC": 1,
        "DEM": 4,
        "MDB": 3,
        "NOVO": 1,
        "PC do B": 1,
        "PDT": 2,
        "PHS": 1,
        "PP": 2,
        "PPS": 1,
        "PR": 2,
        "PRB": 2,
        "PROS": 1,
        "PRP": 1,
        "PSB": 1,
        "PSC": 1,
        "PSD": 3,
        "PSL": 12,
        "PSOL": 4,
        "PT": 1,
        "SOLIDARIEDADE": 1
      },
      "RN": {
        "MDB": 1,
        "PP": 1,
        "PR": 1,
        "PSB": 1,
        "PSD": 1,
        "PSL": 1,
        "PT": 1,
        "PTC": 1
      },
      "RO": {
        "MDB": 1,
        "PDT": 1,
        "PODE": 1,
        "PP": 1,
        "PSB": 1,
        "PSD": 1,
        "PSDB": 1,
        "PSL": 1
      },
      "RR": {
        "PP": 1,
        "PR": 1,
        "PRB": 1,
        "PSD": 1,
        "PSDB": 1,
        "PSL": 1,
        "REDE": 1,
        "SOLIDARIEDADE": 1
      },
      "RS": {
        "DEM": 1,
        "MDB": 4,
        "NOVO": 1,
        "PDT": 3,
        "PP": 4,
        "PR": 1,
        "PRB": 1,
        "PSB": 2,
        "PSD": 1,
        "PSDB": 2,
        "PSL": 3,
        "PSOL": 1,
        "PT": 5,
        "PTB": 2
      },
      "SC": {
        "MDB": 3,
        "NOVO": 1,
        "PP": 1,
        "PPS": 1,
        "PRB": 1,
        "PSB": 1,
        "PSD": 2,
        "PSDB": 1,
        "PSL": 4,
        "PT": 1
      },
      "SE": {
        "MDB": 1,
        "PDT": 1,
        "PP": 1,
        "PR": 1,
        "PSD": 1,
        "PT": 2,
        "SOLIDARIEDADE": 1
      },
      "SP": {
        "DEM": 5,
        "MDB": 2,
        "NOVO": 3,
        "PC do B": 1,
        "PDT": 1,
        "PODE": 3,
        "PP": 4,
        "PPS": 2,
        "PR": 7,
        "PRB": 6,
        "PSB": 4,
        "PSC": 1,
        "PSD": 2,
        "PSDB": 6,
        "PSL": 10,
        "PSOL": 3,
        "PT": 8,
        "PV": 1,
        "SOLIDARIEDADE": 1
      },
      "TO": {
        "DEM": 2,
        "MDB": 1,
        "PR": 1,
        "PSC": 1,
        "PT": 1,
        "SOLIDARIEDADE": 2
      }
    },
    "senado": {
      "AC": {
        "MDB": 1,
        "PP": 1,
        "PSD": 1
      },
      "AL": {
        "MDB": 1,
        "PSDB": 1,
        "PTB": 1
      },
      "AM": {
        "MDB": 1,
        "PSD": 1,
        "PSDB": 1
      },
      "AP": {
        "DEM": 1,
        "PTB": 1,
        "REDE": 1
      },
      "BA": {
        "PSD": 2,
        "PT": 1
      },
      "CE": {
        "PDT": 1,
        "PROS": 1,
        "PSDB": 1
      },
      "DF": {
        "PDT": 1,
        "PSB": 1,
        "PSDB": 1
      },
      "ES": {
        "PMDB": 1,
        "PPS": 1,
        "REDE": 1
      },
      "GO": {
        "DEM": 1,
        "PP": 1,
        "PRP": 1
      },
      "MA": {
        "PDT": 1,
        "PPS": 1,
        "PSB": 1
      },
      "MG": {
        "DEM": 1,
        "PHS": 1,
        "PSDB": 1
      },
      "MS": {
        "PMDB": 1,
        "PSL": 1,
        "PTB": 1
      },
      "MT": {
        "DEM": 1,
        "PR": 1,
        "PSD": 1
      },
      "PA": {
        "MDB": 1,
        "PSC": 1,
        "PT": 1
      },
      "PB": {
        "PMDB": 1,
        "PP": 1,
        "PSB": 1
      },
      "PE": {
        "MDB": 1,
        "PSB": 1,
        "PT": 1
      },
      "PI": {
        "MDB": 1,
        "PP": 1,
        "PTB": 1
      },
      "PR": {
        "PODE": 1,
        "PSDB": 1,
        "REDE": 1
      },
      "RJ": {
        "PSB": 1,
        "PSD": 1,
        "PSL": 1
      },
      "RN": {
        "PHS": 1,
        "PT": 1,
        "REDE": 1
      },
      "RO": {
        "DEM": 1,
        "MDB": 1,
        "PDT": 1
      },
      "RR": {
        "DEM": 1,
        "PDT": 1,
        "PRB": 1
      },
      "RS": {
        "PDT": 1,
        "PP": 1,
        "PT": 1
      },
      "SC": {
        "PMDB": 1,
        "PP": 1,
        "PR": 1
      },
      "SE": {
        "DEM": 1,
        "PT": 1,
        "REDE": 1
      },
      "SP": {
        "PSDB": 2,
        "PSL": 1
      },
      "TO": {
        "PMDB": 1,
        "PSD": 1,
        "SOLIDARIEDADE": 1
      }
    }
  },
  {
    "legislatura": 2023,
    "eleicao": 2022,
    "camara": {
      "AC": {
        "PP": 3,
        "REPUBLICANOS": 2,
        "UNIÃO": 3
      },
      "AL": {
        "MDB": 2,
        "PP": 4,
        "PT": 1,
        "PV": 1,
        "UNIÃO": 1
      },
      "AM": {
        "CIDADANIA": 1,
        "PL": 1,
        "PSD": 2,
        "REPUBLICANOS": 2,
        "UNIÃO": 2
      },
      "AP": {
        "MDB": 1,
        "PC do B": 1,
        "PDT": 2,
        "PL": 1,
        "PP": 1,
        "PSOL": 1,
        "REPUBLICANOS": 1
      },
      "BA": {
        "AVANTE": 1,
        "MDB": 1,
        "PC do B": 2,
        "PDT": 2,
        "PL": 3,
        "PODE": 1,
        "PP": 4,
        "PSB": 1,
        "PSD": 6,
        "PSDB": 1,
        "PT": 7,
        "PV": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 6
      },
      "CE": {
        "MDB": 1,
        "PDT": 5,
        "PL": 6,
        "PP": 1,
        "PSD": 3,
        "PT": 3,
        "UNIÃO": 3
      },
      "DF": {
        "MDB": 1,
        "PL": 2,
        "PSB": 1,
        "PT": 1,
        "PV": 1,
        "REPUBLICANOS": 2
      },
      "ES": {
        "PL": 1,
        "PODE": 2,
        "PP": 2,
        "PSB": 1,
        "PT": 2,
        "REPUBLICANOS": 2
      },
      "GO": {
        "MDB": 2,
        "PDT": 1,
        "PL": 4,
        "PP": 2,
        "PSC": 1,
        "PSD": 1,
        "PSDB": 1,
        "PT": 2,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "MA": {
        "MDB": 1,
        "PATRIOTA": 1,
        "PC do B": 1,
        "PDT": 1,
        "PL": 4,
        "PODE": 1,
        "PP": 2,
        "PSB": 1,
        "PSC": 1,
        "PSD": 1,
        "PT": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "MG": {
        "AVANTE": 5,
        "MDB": 2,
        "PATRIOTA": 3,
        "PDT": 2,
        "PL": 11,
        "PODE": 2,
        "PP": 3,
        "PROS": 1,
        "PSC": 1,
        "PSD": 4,
        "PSDB": 2,
        "PSOL": 1,
        "PT": 10,
        "REPUBLICANOS": 2,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 3
      },
      "MS": {
        "PL": 2,
        "PP": 1,
        "PSDB": 3,
        "PT": 2
      },
      "MT": {
        "MDB": 2,
        "PL": 4,
        "UNIÃO": 2
      },
      "PA": {
        "MDB": 9,
        "PL": 3,
        "PSD": 2,
        "PT": 2,
        "UNIÃO": 1
      },
      "PB": {
        "PL": 2,
        "PP": 2,
        "PSB": 1,
        "PSC": 2,
        "PT": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 1
      },
      "PE": {
        "AVANTE": 1,
        "MDB": 1,
        "PC do B": 1,
        "PL": 4,
        "PP": 4,
        "PSB": 5,
        "PT": 1,
        "PV": 1,
        "REDE": 1,
        "REPUBLICANOS": 2,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 3
      },
      "PI": {
        "PP": 2,
        "PSD": 3,
        "PT": 4,
        "PV": 1
      },
      "PR": {
        "MDB": 1,
        "PL": 3,
        "PODE": 1,
        "PP": 4,
        "PROS": 1,
        "PSB": 1,
        "PSD": 7,
        "PSDB": 1,
        "PT": 5,
        "PV": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 4
      },
      "RJ": {
        "MDB": 2,
        "PC do B": 1,
        "PDT": 1,
        "PL": 11,
        "PODE": 1,
        "PP": 3,
        "PROS": 1,
        "PSB": 1,
        "PSD": 4,
        "PSOL": 5,
        "PT": 5,
        "PTB": 1,
        "REPUBLICANOS": 3,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 6
      },
      "RN": {
        "PL": 4,
        "PT": 2,
        "UNIÃO": 2
      },
      "RO": {
        "MDB": 2,
        "PL": 2,
        "PODE": 1,
        "UNIÃO": 3
      },
      "RR": {
        "MDB": 2,
        "PSD": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 2
      },
      "RS": {
        "CIDADANIA": 1,
        "MDB": 3,
        "NOVO": 1,
        "PC do B": 1,
        "PDT": 2,
        "PL": 4,
        "PODE": 1,
        "PP": 3,
        "PSB": 1,
        "PSD": 1,
        "PSDB": 2,
        "PSOL": 1,
        "PT": 6,
        "REPUBLICANOS": 3,
        "UNIÃO": 1
      },
      "SC": {
        "CIDADANIA": 1,
        "MDB": 3,
        "NOVO": 1,
        "PL": 6,
        "PSD": 2,
        "PT": 2,
        "UNIÃO": 1
      },
      "SE": {
        "PL": 1,
        "PP": 1,
        "PSD": 2,
        "PT": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "SP": {
        "CIDADANIA": 2,
        "MDB": 5,
        "NOVO": 1,
        "PL": 17,
        "PODE": 3,
        "PP": 4,
        "PSB": 2,
        "PSC": 1,
        "PSD": 3,
        "PSDB": 3,
        "PSOL": 5,
        "PT": 11,
        "REDE": 1,
        "REPUBLICANOS": 5,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 6
      },
      "TO": {
        "PL": 2,
        "PODE": 1,
        "PP": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 1
      }
    },
    "senado": {
      "AC": {
        "MDB": 1,
        "PSD": 1,
        "UNIÃO": 1
      },
      "AL": {
        "MDB": 2,
        "PSDB": 1
      },
      "AM": {
        "MDB": 1,
        "PSD": 1,
        "PSDB": 1
      },
      "AP": {
        "PTB": 1,
        "REDE": 1,
        "UNIÃO": 1
      },
      "BA": {
        "PSD": 2,
        "PT": 1
      },
      "CE": {
        "PDT": 1,
        "PROS": 1,
        "PT": 1
      },
      "DF": {
        "PSB": 1,
        "PSDB": 1,
        "REPUBLICANOS": 1
      },
      "ES": {
        "PL": 1,
        "PPS": 1,
        "REDE": 1
      },
      "GO": {
        "PL": 1,
        "PP": 1,
        "PRP": 1
      },
      "MA": {
        "PDT": 1,
        "PPS": 1,
        "PSB": 1
      },
      "MG": {
        "DEM": 1,
        "PHS": 1,
        "PSC": 1
      },
      "MS": {
        "PP": 1,
        "PSL": 1,
        "PTB": 1
      },
      "MT": {
        "DEM": 1,
        "PL": 1,
        "PSD": 1
      },
      "PA": {
        "MDB": 1,
        "PSC": 1,
        "PT": 1
      },
      "PB": {
        "PP": 1,
        "PSB": 1,
        "UNIÃO": 1
      },
      "PE": {
        "MDB": 1,
        "PT": 2
      },
      "PI": {
        "MDB": 1,
        "PP": 1,
        "PT": 1
      },
      "PR": {
        "PODE": 1,
        "REDE": 1,
        "UNIÃO": 1
      },
      "RJ": {
        "PL": 1,
        "PSD": 1,
        "PSL": 1
      },
      "RN": {
        "PHS": 1,
        "PL": 1,
        "REDE": 1
      },
      "RO": {
        "DEM": 1,
        "MDB": 1,
        "PL": 1
      },
      "RR": {
        "DEM": 1,
        "PP": 1,
        "PRB": 1
      },
      "RS": {
        "PP": 1,
        "PT": 1,
        "REPUBLICANOS": 1
      },
      "SC": {
        "PL": 1,
        "PP": 1,
        "PR": 1
      },
      "SE": {
        "PP": 1,
        "PT": 1,
        "REDE": 1
      },
      "SP": {
        "PL": 1,
        "PSDB": 1,
        "PSL": 1
      },
      "TO": {
        "PSD": 1,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 1
      }
    }
  },
  {
    "legislatura": 2027,
    "eleicao": 2026,
    "camara": {
      "AC": {
        "MDB": 1,
        "PCDOB": 1,
        "PL": 1,
        "PP": 2,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "AL": {
        "MDB": 2,
        "PP": 3,
        "PSD": 2,
        "PSDB": 1,
        "UNIÃO": 1
      },
      "AM": {
        "MDB": 2,
        "PL": 2,
        "PSD": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "AP": {
        "PCDOB": 1,
        "PDT": 2,
        "PL": 1,
        "PODE": 1,
        "UNIÃO": 3
      },
      "BA": {
        "AVANTE": 3,
        "MDB": 1,
        "PCDOB": 3,
        "PDT": 1,
        "PL": 4,
        "PP": 2,
        "PSB": 1,
        "PSD": 6,
        "PSDB": 2,
        "PT": 7,
        "REPUBLICANOS": 3,
        "UNIÃO": 6
      },
      "CE": {
        "MDB": 2,
        "PL": 4,
        "PP": 2,
        "PRD": 1,
        "PSB": 4,
        "PSD": 3,
        "PT": 3,
        "REPUBLICANOS": 1,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 1
      },
      "DF": {
        "MDB": 1,
        "PL": 3,
        "PSOL": 1,
        "PT": 1,
        "PV": 1,
        "REPUBLICANOS": 1
      },
      "ES": {
        "PL": 2,
        "PODE": 1,
        "PP": 1,
        "PSB": 1,
        "PT": 2,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "GO": {
        "MDB": 2,
        "PL": 4,
        "PODE": 1,
        "PP": 1,
        "PRD": 1,
        "PSD": 2,
        "PT": 2,
        "REPUBLICANOS": 1,
        "UNIÃO": 3
      },
      "MA": {
        "MDB": 5,
        "PCDOB": 1,
        "PDT": 1,
        "PL": 4,
        "PP": 1,
        "PRD": 1,
        "PSDB": 1,
        "PT": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "MG": {
        "AVANTE": 1,
        "MDB": 1,
        "PL": 21,
        "PODE": 1,
        "PP": 2,
        "PRD": 1,
        "PSB": 1,
        "PSD": 2,
        "PSDB": 1,
        "PSOL": 1,
        "PT": 12,
        "PV": 1,
        "REDE": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 4
      },
      "MS": {
        "PL": 3,
        "PP": 1,
        "PT": 1,
        "REPUBLICANOS": 2,
        "UNIÃO": 1
      },
      "MT": {
        "PL": 3,
        "PODE": 1,
        "PT": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "PA": {
        "MDB": 6,
        "PL": 3,
        "PODE": 2,
        "PP": 1,
        "PSB": 1,
        "PSD": 2,
        "PT": 2
      },
      "PB": {
        "PCDOB": 1,
        "PL": 2,
        "PODE": 1,
        "PP": 2,
        "PSD": 1,
        "PT": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 1
      },
      "PE": {
        "AVANTE": 1,
        "MDB": 1,
        "NOVO": 1,
        "PL": 2,
        "PODE": 3,
        "PP": 2,
        "PSB": 4,
        "PSD": 2,
        "PSOL": 1,
        "PT": 3,
        "PV": 1,
        "REPUBLICANOS": 2,
        "UNIÃO": 2
      },
      "PI": {
        "MDB": 2,
        "PP": 1,
        "PSD": 2,
        "PT": 3,
        "PV": 1,
        "REPUBLICANOS": 1
      },
      "PR": {
        "MDB": 1,
        "NOVO": 4,
        "PL": 5,
        "PODE": 2,
        "PP": 4,
        "PSD": 4,
        "PT": 5,
        "PV": 1,
        "REPUBLICANOS": 2,
        "UNIÃO": 2
      },
      "RJ": {
        "MDB": 1,
        "NOVO": 1,
        "PCDOB": 2,
        "PDT": 1,
        "PL": 15,
        "PP": 5,
        "PSD": 4,
        "PSDB": 4,
        "PSOL": 4,
        "PT": 6,
        "REPUBLICANOS": 1,
        "SOLIDARIEDADE": 1,
        "UNIÃO": 1
      },
      "RN": {
        "PL": 3,
        "PP": 1,
        "PT": 1,
        "PV": 2,
        "UNIÃO": 1
      },
      "RO": {
        "PL": 3,
        "PODE": 2,
        "PSD": 1,
        "UNIÃO": 2
      },
      "RR": {
        "PL": 1,
        "PODE": 2,
        "REPUBLICANOS": 3,
        "UNIÃO": 2
      },
      "RS": {
        "MDB": 3,
        "NOVO": 1,
        "PCDOB": 1,
        "PDT": 1,
        "PL": 8,
        "PODE": 2,
        "PP": 4,
        "PSD": 2,
        "PSOL": 1,
        "PT": 5,
        "REPUBLICANOS": 2,
        "UNIÃO": 1
      },
      "SC": {
        "MDB": 1,
        "NOVO": 1,
        "PCDOB": 1,
        "PL": 7,
        "PODE": 1,
        "PP": 1,
        "PSD": 1,
        "PT": 2,
        "REPUBLICANOS": 1
      },
      "SE": {
        "PP": 1,
        "PSB": 1,
        "PSD": 2,
        "PT": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 2
      },
      "SP": {
        "MDB": 4,
        "MISSÃO": 1,
        "NOVO": 2,
        "PL": 19,
        "PODE": 6,
        "PP": 3,
        "PRD": 1,
        "PSB": 2,
        "PSD": 6,
        "PSDB": 1,
        "PSOL": 6,
        "PT": 11,
        "REPUBLICANOS": 6,
        "UNIÃO": 2
      },
      "TO": {
        "PL": 1,
        "PODE": 1,
        "PP": 1,
        "PSDB": 1,
        "REPUBLICANOS": 3,
        "UNIÃO": 1
      }
    },
    "senado": {
      "AC": {
        "PL": 1,
        "REPUBLICANOS": 1,
        "UNIÃO": 1
      },
      "AL": {
        "MDB": 1,
        "PP": 1,
        "PSDB": 1
      },
      "AM": {
        "MDB": 1,
        "PSD": 1,
        "PSDB": 1
      },
      "AP": {
        "PODE": 1,
        "PSD": 1,
        "UNIÃO": 1
      },
      "BA": {
        "PSD": 1,
        "PT": 2
      },
      "CE": {
        "PSB": 1,
        "PT": 1,
        "REDE": 1
      },
      "DF": {
        "PL": 2,
        "REPUBLICANOS": 1
      },
      "ES": {
        "PL": 1,
        "PSB": 1,
        "REPUBLICANOS": 1
      },
      "GO": {
        "PL": 2,
        "UNIÃO": 1
      },
      "MA": {
        "NOVO": 1,
        "PP": 1,
        "PSB": 1
      },
      "MG": {
        "PL": 1,
        "PSC": 1,
        "PT": 1
      },
      "MS": {
        "PL": 2,
        "PP": 1
      },
      "MT": {
        "PL": 2,
        "UNIÃO": 1
      },
      "PA": {
        "MDB": 1,
        "PT": 1,
        "UNIÃO": 1
      },
      "PB": {
        "MDB": 1,
        "PSB": 1,
        "UNIÃO": 1
      },
      "PE": {
        "PDT": 1,
        "PT": 2
      },
      "PI": {
        "MDB": 1,
        "PSD": 1,
        "PT": 1
      },
      "PR": {
        "NOVO": 1,
        "PL": 1,
        "UNIÃO": 1
      },
      "RJ": {
        "PL": 3
      },
      "RN": {
        "PL": 1,
        "PODE": 1,
        "PT": 1
      },
      "RO": {
        "PL": 3
      },
      "RR": {
        "MDB": 1,
        "PL": 1,
        "PP": 1
      },
      "RS": {
        "NOVO": 1,
        "PL": 1,
        "REPUBLICANOS": 1
      },
      "SC": {
        "PL": 3
      },
      "SE": {
        "MDB": 1,
        "PP": 1,
        "PT": 1
      },
      "SP": {
        "PL": 2,
        "PP": 1
      },
      "TO": {
        "MDB": 1,
        "PL": 1,
        "UNIÃO": 1
      }
    }
  }
];
