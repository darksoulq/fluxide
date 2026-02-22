@echo off
title Python HTTP Server (Port 8080)

echo Starting Python HTTP Server on port 8080...
echo.

python -m http.server 8080

echo.
echo Server has stopped.
pause