# PDF Toolbox

A simple, modern web application for manipulating PDF files. Merge multiple PDFs, delete pages, or extract specific pages—all through a clean, browser-based interface.

## Features

- **Merge PDFs**: Combine up to 20 PDF files into one document with drag-to-reorder functionality
- **Delete Pages**: Remove specific pages from a PDF using simple page specifications (e.g., "1,3,5-7")
- **Extract Pages**: Create a new PDF containing only the pages you specify
- **Browser-based processing**: Upload files and download results directly in your browser
- **No file storage**: All processing happens in memory; files are deleted immediately after processing

## Tech Stack

- **Backend**: Python FastAPI with pikepdf (qpdf wrapper)
- **Frontend**: Plain HTML + Tailwind CSS + vanilla JavaScript
- **Deployment**: Docker + Docker Compose + Traefik reverse proxy
- **SSL**: Automatic Let's Encrypt certificates via Traefik

## Hosting Selection Guide

### Recommended VPS Specifications

For a small to medium traffic deployment:

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| vCPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB SSD | 40 GB SSD |
| Bandwidth | 1 TB/month | 2 TB/month |

**Why these specs?**
- PDF processing with qpdf is efficient but memory-intensive for large files
- 2 vCPU allows parallel processing of requests without blocking
- 4 GB RAM provides headroom for multiple simultaneous large file operations
- SSD storage significantly improves container startup and file I/O performance

### Scaling Notes

- **Single-instance deployment** handles ~10-20 concurrent users comfortably
- **Horizontal scaling**: Add multiple app containers behind Traefik with a load balancer
- **Worker architecture**: For high-volume deployments, consider adding a task queue (Celery + Redis) to offload PDF processing
- **CDN**: Serve static assets via CDN for improved page load times

### Popular VPS Providers

- DigitalOcean (Droplets)
- Linode (Akamai)
- Hetzner (affordable EU hosting)
- AWS Lightsail
- Vultr

Look for providers with straightforward DNS management for easy domain configuration.

---

## Quick Start (Local Development)

### Prerequisites

- Python 3.11+
- pip
- (Optional) Docker and Docker Compose

### Option 1: Running with Python directly

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd pdf-toolbox
   ```

2. Install system dependencies:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y qpdf

   # macOS
   brew install qpdf
   ```

3. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

4. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the application:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. Open your browser to `http://localhost:8000`

### Option 2: Running with Docker

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd pdf-toolbox
   ```

2. Build and run:
   ```bash
   docker build -t pdf-toolbox .
   docker run -p 8000:8000 pdf-toolbox
   ```

3. Open your browser to `http://localhost:8000`

---

## Deployment on Ubuntu 22.04 VPS

### Prerequisites

- Ubuntu 22.04 LTS server
- A domain name pointed to your server's IP address
- Root or sudo access

### Step 1: Update System and Install Docker

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install necessary packages
sudo apt install -y curl git

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Add your user to docker group (optional, to run docker without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Configure DNS

1. Go to your domain registrar's DNS management
2. Add an **A record** pointing your subdomain (e.g., `pdf.yourdomain.com`) to your VPS's IP address
3. Wait for DNS propagation (usually 5-30 minutes)

### Step 3: Deploy the Application

```bash
# Clone the repository (or upload files via scp/sftp)
git clone <your-repo-url>
cd pdf-toolbox

# Create environment file
cp .env.example .env

# Edit the .env file with your domain and email
nano .env
```

Edit `.env` with your values:
```bash
DOMAIN=pdf.yourdomain.com
LE_EMAIL=your@email.com
```

```bash
# Create traefik directory for LetsEncrypt
mkdir -p traefik/letsencrypt

# Set proper permissions
chmod 600 traefik/letsencrypt

# Start the application
docker compose up -d
```

### Step 4: Verify Deployment

```bash
# Check container status
docker compose ps

# Check logs
docker compose logs -f

# Check your domain
curl https://pdf.yourdomain.com/health
# Should return: {"status":"healthy","service":"pdf-toolbox"}
```

Open your browser and navigate to `https://pdf.yourdomain.com`

### Step 5: Useful Commands

```bash
# View logs
docker compose logs -f app

# Restart the application
docker compose restart

# Stop the application
docker compose down

# Update the application
git pull
docker compose build
docker compose up -d
```

---

## Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DOMAIN` | Your domain name | `pdf.example.com` | Yes |
| `LE_EMAIL` | Email for Let's Encrypt notifications | `admin@example.com` | Yes |

---

## Configuration Options

### File Size Limits

Default limits are set in `app/main.py`:
- `MAX_FILE_SIZE`: 100 MB per file
- `MAX_MERGE_FILES`: 20 files for merge operation

To change these, edit the values and rebuild the container.

### Rate Limiting

A simple in-memory rate limiter is included but commented out in `app/main.py`. To enable:
1. Uncomment the rate limit check in each endpoint
2. Adjust `RATE_LIMIT` and `RATE_WINDOW` values as needed

For production deployments with multiple containers, use Redis-based rate limiting.

---

## Security Considerations

### Current Safeguards

- File size limits (100 MB per file)
- PDF magic byte validation (`%PDF-` header check)
- Sanitized filenames for downloads
- Temporary files cleaned up after each request
- Non-root container user
- Security headers via Traefik middleware

### Recommended for Production

1. **Firewall**: Configure UFW to only allow ports 80, 443, and SSH
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Fail2Ban**: Protect against brute-force attacks on SSH

3. **Regular Updates**: Keep Docker and system packages updated

4. **Monitoring**: Consider adding logging aggregation (e.g., Loki, ELK stack)

5. **Rate Limiting**: Implement proper rate limiting for production use

6. **Authentication**: If you want to restrict access, add authentication middleware

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/merge` | Merge multiple PDFs (multipart/form-data with `files[]`) |
| POST | `/api/delete-pages` | Delete pages (multipart/form-data with `file` and `pages_spec`) |
| POST | `/api/extract-pages` | Extract pages (multipart/form-data with `file` and `pages_spec`) |
| GET | `/health` | Health check endpoint |

### Page Specification Format

The pages specification accepts:
- Single pages: `1`, `3`, `5`
- Ranges: `1-5`, `10-15`
- Mixed: `1,3,5-7,9`
- With spaces: `1, 3, 5 - 7, 9`

All page numbers are 1-based (first page is page 1, not page 0).

### Error Responses

All endpoints return appropriate HTTP status codes:
- `400 Bad Request`: Invalid input, malformed page specification
- `413 Payload Too Large`: File exceeds size limit
- `422 Unprocessable Entity`: PDF processing error
- `500 Internal Server Error`: Unexpected server error

Error body format:
```json
{
  "detail": "Error message description"
}
```

---

## Project Structure

```
pdf-toolbox/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application and routes
│   ├── pdf_ops.py       # PDF operation functions (merge, delete, extract)
│   └── pagespec.py      # Page specification parser
├── web/
│   ├── index.html       # Frontend HTML
│   └── app.js           # Frontend JavaScript
├── Dockerfile           # Application container definition
├── docker-compose.yml   # Traefik + app orchestration
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
└── README.md            # This file
```

---

## Troubleshooting

### SSL Certificate Issues

If Let's Encrypt fails to issue a certificate:
1. Verify DNS A record is correctly set: `dig pdf.yourdomain.com`
2. Check Traefik logs: `docker compose logs traefik`
3. Ensure ports 80 and 443 are open and not used by other services
4. Wait for DNS propagation (use `dig` to verify)

### Container Won't Start

1. Check logs: `docker compose logs app`
2. Verify no other services are using ports 80/443: `sudo lsof -i :80 -i :443`
3. Ensure Docker daemon is running: `sudo systemctl status docker`

### PDF Processing Errors

1. Verify the uploaded file is a valid PDF
2. Check page specification format
3. Review application logs: `docker compose logs -f app`

---

## License

MIT License - Feel free to use this project for personal or commercial purposes.
