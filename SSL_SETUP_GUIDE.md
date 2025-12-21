# SSL Setup Guide for EC2 Backend

## Problem
The frontend at `https://upscholar.in` is trying to connect to the backend at `http://13.60.254.183:3000`, causing a "Mixed Content" error because HTTPS pages cannot load HTTP resources.

## Solutions

### Option 1: Set up SSL with Let's Encrypt (Recommended)

1. **Install Certbot on EC2:**
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Get a domain name** (if not already have one):
   - Point your domain to `13.60.254.183`
   - Wait for DNS propagation

3. **Generate SSL certificates:**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

4. **Update frontend configuration:**
   - Update `.env` files to use `https://your-domain.com`

### Option 2: Use AWS Certificate Manager with Load Balancer

1. Create an Application Load Balancer
2. Add SSL certificate from AWS Certificate Manager
3. Point the load balancer to your EC2 instance
4. Update DNS to point to the load balancer

### Option 3: Use CloudFlare (Free SSL)

1. **Set up CloudFlare:**
   - Add your domain to CloudFlare
   - Point DNS to CloudFlare
   - Enable SSL/TLS encryption mode

2. **Update frontend:**
   - Use `https://your-domain.com` in frontend config

## Immediate Workaround

For development/testing, you can:

1. **Use the Vercel deployment** (already HTTPS)
2. **Access the frontend via HTTP** instead of HTTPS
3. **Use browser flags** to allow mixed content (not recommended for production)

## Recommended Next Steps

1. Get a domain name for your EC2 instance
2. Set up SSL certificates
3. Update frontend configuration to use HTTPS
4. Test the secure connection

## Domain Options

- Use a subdomain like `api.upscholar.in`
- Buy a new domain for the API
- Use AWS Route 53 for domain management

## Security Benefits

- Encrypted data transmission
- No mixed content warnings
- Better SEO rankings
- User trust and credibility