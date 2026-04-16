#!/bin/bash
# ==========================================
#  Project Manager - PM2 运维快捷命令
#
#  用法: bash scripts/pm2-ops.sh <命令>
# ==========================================

case "$1" in
  start)
    echo "启动服务..."
    pm2 start ecosystem.config.js
    pm2 save
    ;;
  stop)
    echo "停止服务..."
    pm2 stop ecosystem.config.js
    ;;
  restart)
    echo "重启服务..."
    pm2 restart ecosystem.config.js
    ;;
  status)
    pm2 status
    ;;
  logs)
    if [ -n "$2" ]; then
      pm2 logs "$2"
    else
      pm2 logs
    fi
    ;;
  log-server)
    pm2 logs pm-server
    ;;
  log-web)
    pm2 logs pm-web
    ;;
  db-backup)
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "备份数据库到 $BACKUP_FILE ..."
    pg_dump -h localhost -U postgres project_manager > "$BACKUP_FILE"
    echo "备份完成: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    ;;
  db-restore)
    if [ -z "$2" ]; then
      echo "用法: bash scripts/pm2-ops.sh db-restore <备份文件.sql>"
      exit 1
    fi
    echo "从 $2 恢复数据库..."
    pm2 stop pm-server
    psql -h localhost -U postgres -d project_manager < "$2"
    pm2 start pm-server
    echo "恢复完成"
    ;;
  rebuild)
    echo "重新构建并重启..."
    cd packages/shared && npx tsc && cd ../..
    cd apps/server && npx nest build && cd ../..
    cd apps/web && npx next build && cd ../..
    pm2 restart ecosystem.config.js
    echo "重建完成"
    ;;
  monit)
    pm2 monit
    ;;
  *)
    echo ""
    echo "Project Manager - PM2 运维命令"
    echo ""
    echo "  bash scripts/pm2-ops.sh <命令>"
    echo ""
    echo "  start        启动服务"
    echo "  stop         停止服务"
    echo "  restart      重启服务"
    echo "  status       查看状态"
    echo "  logs [名称]  查看日志（可选 pm-server / pm-web）"
    echo "  log-server   查看后端日志"
    echo "  log-web      查看前端日志"
    echo "  db-backup    备份数据库"
    echo "  db-restore   恢复数据库（需指定 .sql 文件）"
    echo "  rebuild      重新构建并重启"
    echo "  monit        实时监控面板"
    echo ""
    ;;
esac
