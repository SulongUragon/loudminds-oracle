#!/bin/bash
# LoudMinds Oracle - One-command git push helper
# Run this AFTER you've created an empty GitHub repo named "loudminds-oracle"

set -e

echo "🔮 LoudMinds Oracle Deploy Helper"
echo ""
read -p "Your GitHub username: " GH_USER
read -p "Repo name (default: loudminds-oracle): " REPO
REPO=${REPO:-loudminds-oracle}

git init -b main 2>/dev/null || git init
git add .
git commit -m "init: loudminds oracle suite" || echo "Already committed"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${GH_USER}/${REPO}.git"
git push -u origin main

echo ""
echo "✅ Pushed to https://github.com/${GH_USER}/${REPO}"
echo ""
echo "NEXT: Open CHECKLIST.md and follow steps 3-7"
