#!/usr/bin/env bash
# Assemble the whole MakerLens site into _site/:
#   site/                      → /          (landing page, 404, robots, sitemap)
#   $ASSETS_SRC (default tools/assets) → /assets/  via its scripts/assemble-site.sh
#   $EVENTS_SRC (default tools/events) → /events/  via its scripts/assemble-site.sh
# CI checks the tool repos out into tools/ (.github/workflows/deploy.yml); locally,
# point the variables at your own clones, e.g.
#   ASSETS_SRC=../rpgmaker-assets-viewer EVENTS_SRC=../rpgmaker-events-viewer npm run build
set -euo pipefail
cd "$(dirname "$0")/.."
assets=${ASSETS_SRC:-tools/assets}
events=${EVENTS_SRC:-tools/events}
for src in "$assets" "$events"; do
  [ -x "$src/scripts/assemble-site.sh" ] || { echo "missing $src/scripts/assemble-site.sh" >&2; exit 1; }
done
rm -rf _site
cp -R site _site
"$assets/scripts/assemble-site.sh" "$PWD/_site/assets"
"$events/scripts/assemble-site.sh" "$PWD/_site/events"
echo "built _site/ ($(find _site -type f | wc -l) files)"
