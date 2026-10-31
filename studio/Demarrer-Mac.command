#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Téléchargez-le sur https://nodejs.org (bouton LTS), installez-le, puis relancez ce fichier."
  read -r -p "Appuyez sur Entrée pour fermer." && exit 1
fi
if [ ! -d node_modules ]; then
  echo "Première installation, patientez une à deux minutes…"
  npm install --no-audit --no-fund || { echo "Échec de l'installation."; read -r; exit 1; }
fi
[ -f .env ] || cp .env.example .env
(sleep 2; open http://localhost:3777) &
echo
echo "  Studio Créa IA démarré : http://localhost:3777  (laissez cette fenêtre ouverte)"
echo "  Pour arrêter : fermez cette fenêtre."
echo
node server/index.js
