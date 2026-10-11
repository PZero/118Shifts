// Anagrafica medici: abbinamento dei nomi dell'Excel ai medici, con alias e normalizzazione.

export interface Medico {
  id: string;
  nome: string;
  alias: string[];
  attivo?: boolean;
}

/**
 * Chiave di confronto di un nome: minuscolo, senza accenti, senza spazi
 * (anche non separabili), apostrofi, punti e trattini.
 * Es. "De santis" e "Desantis" → "desantis"; "D'Àrco" → "darco".
 */
export function normalizzaNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Pulizia "di presentazione" del nome letto dall'Excel: spazi normalizzati, nient'altro. */
export function pulisciNome(nome: unknown): string {
  if (nome === null || nome === undefined) return '';
  return String(nome)
    .replace(/[\u00A0\u2007\u202F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type EsitoAbbinamento =
  | { tipo: 'nome' | 'alias'; medico: Medico }
  | { tipo: 'ambiguo'; candidati: Medico[] }
  | { tipo: 'nessuno'; suggerimenti: Medico[] };

function chiaviDi(m: Medico): string[] {
  return [m.nome, ...m.alias].map(normalizzaNome).filter((k) => k !== '');
}

/** Distanza di Levenshtein (per i suggerimenti, mai per l'abbinamento automatico). */
export function distanza(a: string, b: string): number {
  const riga = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonale = riga[0]!;
    riga[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const sopra = riga[j]!;
      riga[j] = Math.min(sopra + 1, riga[j - 1]! + 1, diagonale + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonale = sopra;
    }
  }
  return riga[b.length]!;
}

function paroleOrdinate(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join('');
}

/**
 * Abbina un nome dell'Excel a un medico dell'anagrafica.
 * Regola: abbinamento automatico solo se la chiave normalizzata coincide con il nome
 * di un solo medico, oppure (in mancanza) con un alias di un solo medico. Altrimenti si propongono suggerimenti
 * (piccoli refusi o parole in ordine diverso) da confermare a mano, che diventano alias.
 */
export function abbinaNome(nomeExcel: string, medici: readonly Medico[]): EsitoAbbinamento {
  const chiave = normalizzaNome(nomeExcel);
  if (chiave === '') return { tipo: 'nessuno', suggerimenti: [] };

  // Il nome ha la precedenza sugli alias; più medici con la stessa chiave → ambiguo.
  const perNome = medici.filter((m) => normalizzaNome(m.nome) === chiave);
  if (perNome.length === 1) return { tipo: 'nome', medico: perNome[0]! };
  if (perNome.length > 1) return { tipo: 'ambiguo', candidati: perNome };
  const perAlias = medici.filter((m) => m.alias.some((a) => normalizzaNome(a) === chiave));
  if (perAlias.length === 1) return { tipo: 'alias', medico: perAlias[0]! };
  if (perAlias.length > 1) return { tipo: 'ambiguo', candidati: perAlias };

  const soglia = chiave.length <= 5 ? 1 : 2;
  const ordinata = paroleOrdinate(nomeExcel);
  const suggerimenti = medici.filter((m) =>
    [m.nome, ...m.alias].some(
      (n) => distanza(normalizzaNome(n), chiave) <= soglia || (ordinata !== '' && paroleOrdinate(n) === ordinata),
    ),
  );
  return { tipo: 'nessuno', suggerimenti };
}

/** Elenco di chiavi normalizzate usate da più medici (anagrafica da correggere). */
export function chiaviInConflitto(medici: readonly Medico[]): string[] {
  const conteggio = new Map<string, Set<string>>();
  for (const m of medici) {
    for (const k of new Set(chiaviDi(m))) {
      const s = conteggio.get(k) ?? new Set<string>();
      s.add(m.id);
      conteggio.set(k, s);
    }
  }
  return [...conteggio].filter(([, ids]) => ids.size > 1).map(([k]) => k);
}

/** Aggiunge un alias (se non già equivalente al nome o a un alias esistente). */
export function conAlias(medico: Medico, alias: string): Medico {
  const pulito = pulisciNome(alias);
  const k = normalizzaNome(pulito);
  if (k === '' || chiaviDi(medico).includes(k)) return medico;
  return { ...medico, alias: [...medico.alias, pulito] };
}
