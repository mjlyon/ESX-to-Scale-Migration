#!/usr/bin/env bash
curl -sf http://localhost:8080/api/health || exit 1
