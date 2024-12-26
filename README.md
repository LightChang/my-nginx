# my-nginx

`my-nginx` 是一個基於 Node.js 的應用程式，透過 Nginx Proxy Manager Docker & PM2 管理並支援靜態檔案伺服功能。

---

## 配置文件

### `ecosystem.config.js`
以下是 PM2 配置文件的內容，負責管理應用程式的啟動與環境變數設定：

```javascript
module.exports = {
  apps: [
    {
      name: "my-nginx", // 應用程式名稱
      script: "index.js", // 啟動的主程式
      env: {
        PROXY_HOST_DIR: "./data/nginx/proxy_host", // 對應到 docker-compose.yml 中 volumes: ./data:/data。
        WWW: JSON.stringify(["www"]),              // 對應到 app.use(express.static(d_static)) 定義靜態目錄名稱 ./www/{docker.server_name}，可設定多個路徑。
      },
    },
  ],
};
