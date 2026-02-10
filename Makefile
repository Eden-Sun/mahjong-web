.PHONY: help build run test clean install-deps backend-build backend-run backend-test frontend-serve all

# Variables
BACKEND_DIR := backend
FRONTEND_DIR := frontend
PORT := 8080
BACKEND_OUT := $(BACKEND_DIR)/mj-server

# Colors
GREEN := \033[0;32m
BLUE := \033[0;34m
NC := \033[0m # No Color

help:
	@echo "$(BLUE)麻將 Web UI - Makefile 幫助$(NC)"
	@echo ""
	@echo "使用方式: make [target]"
	@echo ""
	@echo "目標:"
	@echo "  $(GREEN)help$(NC)              - 顯示此幫助信息"
	@echo "  $(GREEN)all$(NC)               - 構建和運行完整應用"
	@echo "  $(GREEN)build$(NC)             - 構建後端二進制文件"
	@echo "  $(GREEN)run$(NC)               - 運行後端服務器（端口 $(PORT)）"
	@echo "  $(GREEN)test$(NC)              - 運行後端測試"
	@echo "  $(GREEN)clean$(NC)             - 清理構建產物"
	@echo "  $(GREEN)install-deps$(NC)      - 安裝 Go 依賴"
	@echo "  $(GREEN)backend-build$(NC)     - 只構建後端"
	@echo "  $(GREEN)backend-run$(NC)       - 只運行後端"
	@echo "  $(GREEN)backend-test$(NC)      - 只測試後端"
	@echo "  $(GREEN)frontend-serve$(NC)    - 從前端目錄運行簡單伺服器"
	@echo ""
	@echo "例子:"
	@echo "  make build          # 構建後端"
	@echo "  make run            # 運行伺服器"
	@echo "  make all            # 一鍵啟動"

# 安裝依賴
install-deps:
	@echo "$(BLUE)安裝 Go 依賴...$(NC)"
	cd $(BACKEND_DIR) && go mod download && go mod tidy
	@echo "$(GREEN)✓ 依賴安裝完成$(NC)"

# 構建後端
build: install-deps
	@echo "$(BLUE)構建後端...$(NC)"
	cd $(BACKEND_DIR) && CGO_ENABLED=0 go build -o mj-server main.go
	@echo "$(GREEN)✓ 後端構建完成: $(BACKEND_OUT)$(NC)"

backend-build: build

# 運行後端
run: build
	@echo "$(BLUE)啟動麻將遊戲伺服器...$(NC)"
	@echo "$(GREEN)💻 後端服務器運行於 http://localhost:$(PORT)$(NC)"
	@echo "$(GREEN)🌐 前端訪問於 http://localhost:$(PORT)$(NC)"
	@echo "$(GREEN)📡 WebSocket 地址: ws://localhost:$(PORT)/ws$(NC)"
	@echo ""
	@echo "按 Ctrl+C 停止伺服器"
	@echo ""
	cd $(BACKEND_DIR) && ./mj-server

backend-run: run

# 運行測試
test: install-deps
	@echo "$(BLUE)運行後端測試...$(NC)"
	cd $(BACKEND_DIR) && go test -v ./...
	@echo "$(GREEN)✓ 測試完成$(NC)"

backend-test: test

# 清理
clean:
	@echo "$(BLUE)清理構建產物...$(NC)"
	cd $(BACKEND_DIR) && rm -f mj-server
	@echo "$(GREEN)✓ 清理完成$(NC)"

# 一鍵啟動
all: clean install-deps build run

# 檢查代碼風格
lint:
	@echo "$(BLUE)檢查代碼風格...$(NC)"
	cd $(BACKEND_DIR) && go fmt ./...
	cd $(BACKEND_DIR) && go vet ./...
	@echo "$(GREEN)✓ 代碼檢查完成$(NC)"

# 查看項目結構
tree:
	@echo "$(BLUE)麻將 Web UI 項目結構:$(NC)"
	@tree -L 3 -I '__pycache__|node_modules' . 2>/dev/null || find . -type f -name '*.go' -o -name '*.html' -o -name '*.css' -o -name '*.js' | grep -v '\.git' | sort

# 顯示配置信息
info:
	@echo "$(BLUE)項目配置信息:$(NC)"
	@echo ""
	@echo "  項目目錄: $(shell pwd)"
	@echo "  後端目錄: $(BACKEND_DIR)"
	@echo "  前端目錄: $(FRONTEND_DIR)"
	@echo "  伺服器端口: $(PORT)"
	@echo ""
	@echo "$(BLUE)Go 環境:$(NC)"
	@go version
	@echo ""
	@echo "$(BLUE)後端文件:$(NC)"
	@ls -lh $(BACKEND_DIR)/main.go 2>/dev/null || echo "  main.go 未找到"
	@echo ""
	@echo "$(BLUE)前端文件:$(NC)"
	@ls -lh $(FRONTEND_DIR)/index.html 2>/dev/null || echo "  index.html 未找到"

# 開發模式（帶自動重新加載）
dev:
	@command -v air >/dev/null 2>&1 || { echo "$(BLUE)安裝 air 用於自動重新加載...$(NC)"; go install github.com/cosmtrek/air@latest; }
	@echo "$(BLUE)以開發模式啟動（自動重新加載）...$(NC)"
	cd $(BACKEND_DIR) && air

.DEFAULT_GOAL := help
