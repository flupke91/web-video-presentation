# 网络诊断脚本
echo "网络连接测试:"
echo "=============="

# 常见的 GitHub 相关域名
 = @(
    "github.com",
    "api.github.com",
    "github.githubassets.com"
)

foreach ( in ) {
    try {
         = Test-NetConnection -ComputerName  -Port 443 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if (.TcpTestSucceeded) {
            Write-Host "✅  : 连接正常" -ForegroundColor Green
        } else {
            Write-Host "❌  : 连接失败" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌  : 错误: " -ForegroundColor Red
    }
}

echo ""
echo "代理设置检查:"
echo "=============="
netsh winhttp show proxy
echo ""

echo "Git 配置检查:"
echo "=============="
git config --global --list | Select-String -Pattern "http|proxy" -CaseSensitive:False
echo ""

echo "建议:"
echo "======"
echo "1. 检查网络连接 (WiFi/有线)"
echo "2. 暂时关闭 VPN/代理"
echo "3. 尝试手机热点"
echo "4. 等待网络恢复后执行推送"
