// Calendario di un medico in sola lettura, per amministratore e delegati.
// I cambi turno sono privati del medico: non vengono letti né mostrati.

import { Link, useParams } from 'wouter';
import { useEffect, useState } from 'react';
import { useServizi } from '../../sessione/contesto';
import { Icona } from '../../ui/Icona';
import { CalendarioMedico } from '../medico/AreaMedico';

export function CalendarioStaff() {
  const { id } = useParams<{ id: string }>();
  const servizi = useServizi();
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    servizi
      .medici()
      .then((l) => attivo && setNome(l.find((m) => m.id === id)?.nome ?? ''))
      .catch(() => attivo && setNome(''));
    return () => {
      attivo = false;
    };
  }, [servizi, id]);

  const intestazione = (
    <div className="intestazione-sezione">
      <div>
        <Link href="/gestione/medici" className="btn btn-fantasma btn-piccolo">
          <Icona nome="indietro" piccola /> Medici
        </Link>
        <h1>{nome === null ? 'Calendario del medico' : nome || 'Medico'}</h1>
      </div>
    </div>
  );

  return <CalendarioMedico key={id} medicoId={id} principale={false} soloLettura base={`/gestione/medici/${id}`} intestazione={intestazione} />;
}
