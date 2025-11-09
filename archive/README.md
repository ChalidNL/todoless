# Archive

This folder contains deprecated files and environment-specific compose examples.

## Deprecated Files (No longer in use)
- `Dockerfile.fullstack` - Old single-container approach (superseded by two-container nginx+api)
- `generate-icons.html` - Icon generator tool (moved from root/public)
- `generate-pwa-icons.mjs` - PWA icon generation script

## Compose File Examples (Copy to root as needed)
- `docker-compose.dev.yml.example` - Local development environment
- `docker-compose.integration.yml.example` - CI/CD integration testing
- `docker-compose.staging.yml.example` - Pre-production staging

**Usage**: Copy `.example` files to root directory without the `.example` suffix:
```bash
# Windows
Copy-Item archive\docker-compose.dev.yml.example docker-compose.dev.yml

# Linux/Mac
cp archive/docker-compose.dev.yml.example docker-compose.dev.yml
```

These compose files are not committed to git to keep the repository clean with only the canonical `docker-compose.yml` for production.

## Note
Files here are archived to preserve project history. The compose examples are reference implementations that users can copy and customize locally.
