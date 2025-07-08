#!/bin/bash
set -e # Прерывать скрипт при любой ошибке

# --- НАСТРОЙКИ ---
APP_USER="root" # Имя пользователя, от которого будет работать сервис.
GIT_REPO_URL="https://github.com/angryflaren/gemini-gateway.git"
PROJECT_DIR="/var/www/gemini_gateway"
FRONTEND_URL="https://angryflaren.github.io"

echo "--- Запуск полной установки Gemini Gateway для пользователя '$APP_USER' ---"

# --- 1. Установка всех системных зависимостей ---
echo "--- 1/7: Установка системных зависимостей... ---"
sudo apt-get update && sudo apt-get install -y git nginx python3-pip python3-venv ufw curl screen

# --- 2. Настройка файрвола (в правильном порядке) ---
echo "--- 2/7: Настройка файрвола... ---"
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# --- 3. Клонирование репозитория с GitHub ---
echo "--- 3/7: Клонирование проекта с GitHub... ---"
sudo rm -rf $PROJECT_DIR
sudo git clone $GIT_REPO_URL $PROJECT_DIR
sudo chown -R $APP_USER:$APP_USER $PROJECT_DIR

# --- 4. Настройка виртуального окружения Python ---
echo "--- 4/7: Установка зависимостей Python... ---"
cd $PROJECT_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# --- 5. Создание файла сервиса Systemd (Надёжный метод) ---
echo "--- 5/7: Создание файла сервиса... ---"
cat << EOF | sudo tee /etc/systemd/system/gemini-gateway.service > /dev/null
[Unit]
Description=Gemini Gateway Backend Service
After=network.target

[Service]
User=$APP_USER
Group=www-data
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/venv/bin/uvicorn --host 127.0.0.1 --port 8000 --workers 4 main:app

[Install]
WantedBy=multi-user.target
EOF

# --- 6. Создание конфигурации Nginx (Надёжный метод) ---
echo "--- 6/7: Создание конфигурации Nginx... ---"
sudo rm -f /etc/nginx/sites-enabled/default
cat << EOF | sudo tee /etc/nginx/sites-available/gemini_gateway > /dev/null
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;
    proxy_connect_timeout 300s;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
sudo rm -f /etc/nginx/sites-enabled/gemini_gateway
sudo ln -s /etc/nginx/sites-available/gemini_gateway /etc/nginx/sites-enabled/

# --- 7. Запуск и финальная проверка ---
echo "--- 7/7: Запуск и проверка сервисов... ---"
sudo systemctl daemon-reload
sudo systemctl restart nginx
sudo systemctl enable gemini-gateway
sudo systemctl restart gemini-gateway

echo "--- УСТАНОВКА ЗАВЕРШЕНА! ---"
echo "Бэкенд должен быть запущен. Проверка статуса через 3 секунды:"
sleep 3
sudo systemctl status gemini-gateway.service --no-pager -l