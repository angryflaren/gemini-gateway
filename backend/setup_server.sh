#!/bin/bash
set -e # Stop the script on any error

# --- Check username ---
if [ -z "$1" ]; then
    exit 1
fi
APP_USER=$1
PROJECT_DIR="/var/www/gemini_gateway"

echo "--- Starting Gemini Gateway setup for user '$APP_USER' ---"

# --- 1. Configure Firewall (CORRECT ORDER) ---
echo "--- Configuring firewall... ---"
sudo ufw allow ssh          # FIRST, allow SSH
sudo ufw allow 'Nginx Full' # Then, allow web traffic
sudo ufw --force enable     # Enable firewall without asking

# --- 2. Install System Dependencies ---
echo "--- Installing system dependencies... ---"
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv nginx

# --- 3. Clean and Create Directories ---
echo "--- Creating project directories... ---"
sudo rm -rf $PROJECT_DIR
sudo mkdir -p $PROJECT_DIR
# Copy contents from the script's folder
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
sudo cp -r "$SCRIPT_DIR"/* "$PROJECT_DIR/"
sudo chown -R $APP_USER:$APP_USER $PROJECT_DIR

# --- 4. Setup Python Virtual Environment ---
echo "--- Installing Python dependencies... ---"
cd $PROJECT_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# --- 5. Create and Configure Systemd Service ---
echo "--- Creating service file... ---"
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

# --- 6. Configure Nginx ---
echo "--- Configuring Nginx... ---"
sudo rm -f /etc/nginx/sites-enabled/default
sudo bash -c "cat > /etc/nginx/sites-available/gemini_gateway" << EOF
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://unix:/tmp/gunicorn_gemini_gateway.sock;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    }
}
EOF
sudo rm -f /etc/nginx/sites-enabled/gemini_gateway
sudo ln -s /etc/nginx/sites-available/gemini_gateway /etc/nginx/sites-enabled/

# --- 7. Start Services ---
echo "--- Starting and checking services... ---"
sudo systemctl daemon-reload
sudo systemctl restart nginx
sudo systemctl restart gemini-gateway
sudo systemctl enable gemini-gateway

echo "--- Setup complete! Checking service status: ---"
sleep 2 # Give the service time to start
sudo systemctl status gemini-gateway.service --no-pager -l