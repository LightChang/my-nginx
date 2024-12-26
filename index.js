// 對照 Nginx Proxy Manager http://:81/nginx/proxy 資料
// pm2 start index.js -n astro
const express = require('express');
const path = require('path');
const fs = require('fs'); 
const { spawnSync } = require('child_process');

const dir = "./proxy_host";
let skip;
fs.watch(dir, (eventType, filename) => {
  if (new Date().getTime() < skip) { return; }
  console.log(dir, filename, eventType);
  main();
  skip = new Date().getTime() + 2500;
});

const getNetstat = () => {
  let cmd;
  switch(process.platform) {
    case "darwin":
      cmd = spawnSync('netstat', ["-an", "|", "grep", "LISTEN"], { encoding : 'utf8' });
      break;
    case "win32":
      cmd = "";
      break;
    default:
      cmd = spawnSync('netstat', ["-tlp"], { encoding : 'utf8' });
      break;
  }
  const result = [];
  cmd.output.forEach(resp => {
    if (!resp) { return; }
    resp.split('\n')
      .filter(line => ["LISTEN"].some(v => line.includes(v)))
      .forEach(line => {
        const txt = line.match(/[^ ]+/g);
        if (txt[txt.length-1] == "LISTEN") {
          // tcp46      0      0  *.3110                 *.*                    LISTEN     
          // tcp46      0      0  *.3102                 *.*                    LISTEN     
          // tcp6       0      0  fe80::aede:48ff:.50386 *.*                    LISTEN     
          // tcp6       0      0  fe80::aede:48ff:.50385 *.*                    LISTEN
          result.push({
            "name": "",
            "port": parseInt(txt[3].split('.').pop())
          });
        }
        else if (txt[5] == "LISTEN") {
          // tcp        0      0 0.0.0.0:81              0.0.0.0:*               LISTEN      160881/docker-proxy
          // tcp        0      0 0.0.0.0:ssh             0.0.0.0:*               LISTEN      310021/sshd: /usr/s
          // tcp6       0      0 :::22                   :::*                    LISTEN      310021/sshd: /usr/s
          // tcp6       0      0 :::3109                 :::*                    LISTEN      952004/node /root/a
          let name = "";
          if (txt.length == 7) {
            name = txt[txt.length-1].split('/').pop();
          }
          else if (txt.length == 8) {
            name = txt[txt.length-2].split('/').pop() + " " + txt[txt.length-1] + " ...";
          }
          result.push({
            name,
            "port": parseInt(txt[3].split(':').pop())
          });
        }
      }
    );
  });
  return result;
};

const running = {};
const main = () => {
  const portInUsed = getNetstat();
  const proxy_host = fs.readdirSync(dir, {withFileTypes: true})
		.filter(f => !f.isDirectory() && path.extname(f.name) == '.conf')
    .map(f => {
      const site = { "file": f.name };
      fs.readFileSync(`${dir}/${f.name}`).toString().split('\n').forEach(line => {
        if (line.includes("server_name")) {
          const txt = line.match(/[^ ;]+/g);
          txt.shift();
          site.dir = txt.shift();
        }
        else if (line.includes("$port")) {
          const txt = line.match(/[^ ;]+/g);
          site.port = parseInt(txt[2]);
        }
      })
      return site;
    }); // console.log('proxy_host', proxy_host);
  for (const host of proxy_host) {
    if (!host.hasOwnProperty('dir') || !host.hasOwnProperty('port')) {
      console.log('異常資料', host);
      continue;
    }
    try {
      const some_port_ap = portInUsed.find(ap => ap.port == host.port);
      if (running.hasOwnProperty(host.dir)) {
        running[host.dir].server.close();
      }
      else if (some_port_ap) {
        console.log(`${host.dir} ${host.port}`, '已有其他程式處理', some_port_ap.name);
        continue;
      }

      const app = express();
      const d_static = path.join(__dirname, `./www/${host.dir}`);
      app.use(express.static(d_static));
      const server = app.listen(host.port);
      running[host.dir] = {
        "port": host.port,
        "root": d_static,
      }
      for (const check of ["index.html"]) {
        running[host.dir][check] = fs.existsSync(`${d_static}/${check}`);
      }
    }
    catch(ex) {
      console.log(`${host.dir} ${host.port}`, '例外狀況', ex);
    }
  }
  console.log('運行的 astro-express 清單', new Date());
  console.table(running);
}
main();
