#!/bin/bash
echo "=== localhost:7071 (Vite proxy) ==="
curl -s http://localhost:7071/api/todoless/setup-status
echo ""
echo "=== 192.168.2.150:7071 (Vite proxy via LAN) ==="
curl -s http://192.168.2.150:7071/api/todoless/setup-status
echo ""
echo "=== localhost:8091 (direct PB) ==="
curl -s http://localhost:8091/api/todoless/setup-status
echo ""
echo "=== 192.168.2.150:8091 (direct PB via LAN) ==="
curl -s http://192.168.2.150:8091/api/todoless/setup-status
echo ""
echo "=== 192.168.2.150:7071/ (frontend) ==="
curl -s -o /dev/null -w "HTTP %{http_code} — %{size_download} bytes\n" http://192.168.2.150:7071/
