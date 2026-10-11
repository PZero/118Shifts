"""Controllo privacy prima del push (repository pubblico).

Cerca nei file tracciati da git:
- i cognomi reali elencati in `dati/nomi-reali.txt` (file locale, escluso da git);
- indirizzi email non di esempio.
Uso: python -I scripts/controlla-privacy.py   (esce con codice 1 se trova qualcosa)
"""
import re
import subprocess
import sys
from pathlib import Path

radice = Path(__file__).resolve().parent.parent
elenco = radice / "dati" / "nomi-reali.txt"
nomi = []
if elenco.exists():
    nomi = [n.strip() for n in elenco.read_text(encoding="utf-8", errors="ignore").splitlines() if n.strip()]
else:
    print("Attenzione: dati/nomi-reali.txt assente, controllo dei cognomi saltato")

pat_nomi = re.compile(r"\b(" + "|".join(re.escape(n) for n in nomi) + r")\b", re.I) if nomi else None
pat_email = re.compile(r"[\w.+-]+@(?!example\.(?:test|com|org)\b)[\w-]+\.[\w.]+", re.I)

file = subprocess.run(["git", "ls-files"], cwd=radice, capture_output=True, text=True).stdout.split()
problemi = 0
for f in file:
    p = radice / f
    if p.suffix.lower() in {".png", ".ico", ".jpg", ".webp"} or p.name == "package-lock.json":
        continue
    try:
        testo = p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        continue
    for n, riga in enumerate(testo.splitlines(), 1):
        if pat_nomi and pat_nomi.search(riga):
            print(f"{f}:{n}: cognome reale")
            problemi += 1
        for m in pat_email.finditer(riga):
            if not m.group(0).startswith(("noreply@", "git@")):
                print(f"{f}:{n}: email {m.group(0)}")
                problemi += 1

print(f"File controllati: {len(file)} - problemi: {problemi}")
sys.exit(1 if problemi else 0)
