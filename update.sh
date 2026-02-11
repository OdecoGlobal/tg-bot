set -e

echo "🔄 Quick update..."

git pull

docker compose restart app

echo "📝 Checking logs..."
docker compose logs --tail=30 app

echo "✅ Update complete!"