#!/bin/bash
set -e # Прерывать скрипт при любой ошибке

echo "--- Starting Gemini Gateway Backend Setup (v2 - Robust) ---"

# --- 1. Очистка старой установки (чтобы избежать конфликтов) ---
echo "--- Cleaning up previous installation attempts... ---"
sudo systemctl stop gemini-gateway.service || true
sudo systemctl disable gemini-gateway.service || true
sudo rm -f /etc/systemd/system/gemini-gateway.service
sudo rm -f /etc/nginx/sites-enabled/gemini_gateway
sudo rm -f /etc/nginx/sites-available/gemini_gateway
sudo rm -rf /var/www/gemini_gateway # Полностью удаляем старую папку
echo "Cleanup complete."

# --- 2. Установка зависимостей ---
echo "--- Installing system dependencies... ---"
sudo apt-get update && sudo apt-get install -y python3-pip python3-venv nginx

# --- 3. Настройка проекта и прав доступа ---
echo "--- Setting up project directory and permissions... ---"
PROJECT_DIR="/var/www/gemini_gateway"
CURRENT_USER=$(whoami)
sudo mkdir -p $PROJECT_DIR
# Копируем файлы ПЕРЕД сменой владельца
sudo cp -r . $PROJECT_DIR
sudo chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR

# --- 4. Настройка виртуального окружения Python ---
echo "--- Setting up Python virtual environment... ---"
cd $PROJECT_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# --- 5. Проверка установки Gunicorn (Важный шаг отладки) ---
echo "--- Verifying Gunicorn installation... ---"
if [ -f "$PROJECT_DIR/backend/venv/bin/gunicorn" ]; then
    echo "SUCCESS: Gunicorn executable found at $PROJECT_DIR/backend/venv/bin/gunicorn"
    sudo chmod +x $PROJECT_DIR/backend/venv/bin/gunicorn # Убедимся, что файл исполняемый
else
    echo "CRITICAL ERROR: Gunicorn was not found after installation. Exiting."
    exit 1
fi

# --- 6. Настройка Nginx ---
echo "--- Configuring Nginx... ---"
sudo bash -c 'cat > /etc/nginx/sites-available/gemini_gateway' << EOF
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://unix:/tmp/gunicorn_gemini_gateway.sock;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/gemini_gateway /etc/nginx/sites-enabled/
sudo nginx -t # Проверка синтаксиса конфига Nginx
sudo systemctl restart nginx

# --- 7. Настройка и запуск сервиса Systemd ---
echo "--- Configuring and starting the systemd service... ---"
sudo cp $PROJECT_DIR/backend/gemini-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start gemini-gateway
sudo systemctl enable gemini-gateway

echo "--- Setup finished. Checking service status... ---"
# Даем сервису секунду на запуск перед проверкой
sleep 1
sudo systemctl status gemini-gateway.service --no-pager -l
