#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Acodax — Download remote image assets locally
# Run once from the project root:  bash download-assets.sh
# ─────────────────────────────────────────────

DEST="assets/images"
mkdir -p "$DEST"

BASE="https://acodax.com/wp-content/uploads"

FILES=(
  "2025/10/32.png"
  "2025/10/34.png"
  "2025/10/35.png"
  "2025/10/36.png"
  "2025/10/38.png"
  "2025/10/40.png"
  "2025/10/41.png"
  "2025/10/aws.png"
  "2025/10/dashboard1.png"
  "2025/10/laravel.png"
  "2025/10/mysql.webp"
  "2025/10/python-3.svg"
  "2026/01/Accounting-2.jpg"
  "2026/01/Acodax-logo-2.png"
  "2026/01/Acodax-logo-4.png"
  "2026/01/Ai-powered.png"
  "2026/01/Effortless-Integrations.png"
  "2026/02/136207.jpg"
  "2026/02/E-invoice.png"
)

OK=0
FAIL=0

for file in "${FILES[@]}"; do
  filename=$(basename "$file")
  url="$BASE/$file"
  out="$DEST/$filename"
  printf "  %-42s " "$filename"
  if curl -fsSL --max-time 30 -A "Mozilla/5.0" -o "$out" "$url"; then
    bytes=$(wc -c < "$out")
    printf "✓  %s bytes\n" "$bytes"
    OK=$((OK + 1))
  else
    printf "✗  FAILED\n"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Done — $OK downloaded, $FAIL failed."
[ "$FAIL" -gt 0 ] && echo "Check your internet connection and re-run for any failed items."
