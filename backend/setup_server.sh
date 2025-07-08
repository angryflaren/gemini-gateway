#!/bin/bash
set -e # Прерывать скрипт при любой ошибке

# --- Проверка имени пользователя ---
if [ -z "$1" ]; then
    exit 1
fi
APP_USER=$1
PROJECT_DIR="/var/www/gemini_gateway"

echo "--- Запуск установки Gemini Gateway для пользователя '$APP_USER' ---"

# --- 1. Настройка файрвола (ПРАВИЛЬНЫЙ ПОРЯДОК) ---
echo "--- Настройка файрвола... ---"
sudo ufw allow ssh          # СНАЧАЛА разрешаем SSH
sudo ufw allow 'Nginx Full' # Затем разрешаем веб-трафик
sudo ufw --force enable     # Включаем файрвол без интерактивного вопроса

# --- 2. Установка системных зависимостей ---
echo "--- Установка системных зависимостей... ---"
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv nginx

# --- 3. Очистка и создание директорий ---
echo "--- Создание директорий проекта... ---"
sudo rm -rf $PROJECT_DIR
sudo mkdir -p $PROJECT_DIR
# Копируем содержимое папки, где лежит скрипт
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
sudo cp -r "$SCRIPT_DIR"/* "$PROJECT_DIR/"
sudo chown -R $APP_USER:$APP_USER $PROJECT_DIR

# --- 4. Настройка виртуального окружения Python ---
echo "--- Установка зависимостей Python... ---"
cd $PROJECT_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# --- 5. Создание и настройка сервиса Systemd ---
echo "--- Создание файла сервиса... ---"
sudo bash -c "cat > /etc/systemd/system/gemini-gateway.service" << EOF
[Unit]
Description=Gemini Gateway Backend Service
After=network.target

[Service]
User=$APP_USER
Group=www-data
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/venv/bin/gunicorn -c gunicorn_conf.py main:app

[Install]
WantedBy=multi-user.target
EOF

# --- 6. Настройка Nginx ---
echo "--- Настройка Nginx... ---"
sudo rm -f /etc/nginx/sites-enabled/default
sudo bash -c "cat > /etc/nginx/sites-available/gemini_gateway" << EOF
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://unix:/tmp/gunicorn_gemini_gateway.sock;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    }
}
EOF
sudo rm -f /etc/nginx/sites-enabled/gemini_gateway
sudo ln -s /etc/nginx/sites-available/gemini_gateway /etc/nginx/sites-enabled/

# --- 7. Запуск сервисов ---
echo "--- Запуск и проверка сервисов... ---"
sudo systemctl daemon-reload
sudo systemctl restart nginx
sudo systemctl restart gemini-gateway
sudo systemctl enable gemini-gateway

echo "--- Установка завершена! Проверка статуса сервиса: ---"
sleep 2 # Даем сервису время на запуск
sudo systemctl status gemini-gateway.service --no-pager -l
