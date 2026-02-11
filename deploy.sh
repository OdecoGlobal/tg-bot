#!/bin/bash

set -e  

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' 

if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env not found!${NC}"
    echo "Please create .env with your secrets."
    exit 1
fi


echo -e "${BLUE}📥 Pulling latest code...${NC}"
git fetch origin main
git reset --hard origin/main


echo -e "${BLUE}🔨 Building Docker images...${NC}"
docker compose build


echo -e "${BLUE}🛑 Stopping old containers...${NC}"
docker compose down


echo -e "${BLUE}▶️  Starting new containers...${NC}"
docker compose up -d


echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
sleep 10


if ! docker compose ps | grep -q "Up"; then
    echo -e "${RED}❌ Error: Services failed to start${NC}"
    docker compose logs
    exit 1
fi


echo -e "${BLUE}🗄️  Running database migrations...${NC}"
docker compose exec -T app npx prisma migrate deploy


echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
docker compose ps

echo ""
echo -e "${BLUE}📝 Recent logs:${NC}"
docker compose logs --tail=20 app

echo ""
echo -e "${GREEN}🎉 Bot is now running!${NC}"
echo -e "${BLUE}View logs: ${NC}docker compose logs -f app"
echo -e "${BLUE}Stop bot: ${NC}docker compose down"