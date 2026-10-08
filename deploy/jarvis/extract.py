import sys
import tarfile
from pathlib import Path

archive, destination = sys.argv[1:]
with tarfile.open(archive, "r:gz") as bundle:
    members = bundle.getmembers()
    if len(members) > 250_000 or sum(member.size for member in members) > 2_000_000_000:
        raise ValueError("A versão excede o limite permitido.")
    for member in members:
        path = Path(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("Caminho fora da versão.")
        if path.parts and path.parts[0] not in {"bin", "web", "REVISION"}:
            raise ValueError("Arquivo fora do pacote de aplicação.")
        if any(part == ".env" or part.startswith(".env.") for part in path.parts):
            raise ValueError("Credenciais não podem integrar uma versão.")
    bundle.extractall(destination, filter="data")
