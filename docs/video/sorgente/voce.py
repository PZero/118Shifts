import asyncio, json, sys
import edge_tts
TESTI = [
 "GestioneTurni. I tuoi turni del 112, sempre in tasca.",
 "Si accede con il proprio account Google: nessuna password nuova da ricordare.",
 "Appena entri, trovi il turno di oggi e di domani, con sede e orario.",
 "Il calendario del mese è già pronto: mattino, pomeriggio e notte a colori, e le festività segnate. Ore e weekend liberi li conta l'app.",
 "Per i mesi non ancora pubblicati, vedi una previsione basata sulla turnazione.",
 "Devi cedere un turno? L'app ti indica chi può darti il cambio, nel rispetto delle undici ore di riposo, e prepara il messaggio da inviare.",
 "Puoi vedere anche quali colleghi sono di turno con te.",
 "I tuoi dati restano riservati: ogni medico vede solo i propri turni, e lo garantiscono le regole del database.",
 "Gratuita, senza pubblicità, su telefono e computer. Inquadra il codice e inizia.",
]
async def main():
    for i,t in enumerate(TESTI):
        await edge_tts.Communicate(t, "it-IT-IsabellaNeural", rate="+4%").save(f"voce/v{i}.mp3")
asyncio.run(main())
