#!/bin/bash
echo "--- Starting Gemini Gateway Backend Setup ---"

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y python3-pip python3-venv nginx

# Create project directory
sudo mkdir -p /var/www/gemini_gateway
CURRENT_USER=$(whoami)
sudo chown -R $CURRENT_USER:www-data /var/www/gemini_gateway
cp -r . /var/www/gemini_gateway/

# Setup Python environment
cd /var/www/gemini_gateway/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# Setup Nginx
sudo rm /etc/nginx/sites-enabled/default
sudo bash -c 'cat > /etc/nginx/sites-available/gemini_gateway' << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://unix:/tmp/gunicorn_gemini_gateway.sock;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/gemini_gateway /etc/nginx/sites-enabled/

# Setup Systemd service
sudo cp gemini-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start gemini-gateway
sudo systemctl enable gemini-gateway

# Restart and check status
sudo systemctl restart nginx
sudo systemctl status gemini-gateway