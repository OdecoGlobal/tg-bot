set -e

echo "🔄 Quick update..."

git fetch origin main
git reset --hard origin/main

docker compose build app

docker compose up -d app

echo "📝 Checking logs..."
docker compose logs --tail=30 app

echo "✅ Update complete!"