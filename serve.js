// Petit serveur local sans dépendance : node serve.js  puis ouvrir http://localhost:5180
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var PORT = +process.env.PORT || 5180;
var TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

http.createServer(function (req, res) {
  var url = decodeURIComponent(req.url.split('?')[0]);
  var file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, function () { console.log('Cube Malin : http://localhost:' + PORT); });
