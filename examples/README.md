# Examples & Templates

This folder contains reference implementations and example configurations.

## Deprecated Files (Historical reference)
- `Dockerfile.fullstack` - Old single-container approach (superseded by two-container nginx+api)
- `generate-icons.html` - Icon generator tool (moved from root/public)
- `generate-pwa-icons.mjs` - PWA icon generation script

## Docker Compose Templates (Copy to root as needed)

### Development Environment
**File**: `docker-compose.dev.yml.example`  
**Purpose**: Local development with Docker  
**Usage**:
```bash
# Windows
Copy-Item examples\docker-compose.dev.yml.example docker-compose.dev.yml

# Linux/Mac
cp examples/docker-compose.dev.yml.example docker-compose.dev.yml

# Run
docker-compose -f docker-compose.dev.yml up --build
```

### Integration Testing
**File**: `docker-compose.integration.yml.example`  
**Purpose**: CI/CD automated testing environment  
**Usage**:
```bash
cp examples/docker-compose.integration.yml.example docker-compose.integration.yml
TAG=pr-123 docker-compose -f docker-compose.integration.yml up -d
```

### Staging Environment
**File**: `docker-compose.staging.yml.example`  
**Purpose**: Pre-production testing and validation  
**Usage**:
```bash
cp examples/docker-compose.staging.yml.example docker-compose.staging.yml
docker-compose -f docker-compose.staging.yml up -d
```

## Why Copy Instead of Use Directly?

1. **Customization**: You can modify copied files for your specific setup without affecting the reference
2. **Git Clean**: Your local customizations won't be committed (they're .gitignored)
3. **Updates**: Pull latest examples from repo and merge changes into your local copies as needed
4. **Multiple Configs**: Create variants (e.g., `docker-compose.dev-custom.yml`) for different scenarios

## Note

These are **template files** - they are committed to the repository as reference implementations. Copy them to the root directory (without the `.example` suffix) to use them. Your copied files will be automatically ignored by git, keeping your local customizations private.
