const express = require('express')
const fs = require('fs')
const app = express()
const http = require('http');
const https = require('https');
const httpPort = 5000;
const httpsPort = 4000;

app.use(express.static("./"))

app.use(express.urlencoded({extended: true}))

app.post('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.post('/embed', (req, res) => {
  console.log(req.body);
  res.sendFile(__dirname + '/select.html');
})

app.get('/xml', (req, res) => {
  res.sendFile(__dirname + "/info.xml");
})

app.get('/models', (req, res) => {
  const models = fs.readdirSync('./sample_models');
  res.send(models);
})

var httpServer = http.createServer(app);
var httpsServer = https.createServer({
  key: fs.readFileSync('server.key'), // Parameter is your signed certificate key
  cert: fs.readFileSync('server.cert') // Parameter is your signed certificate
}, app);

httpServer.listen(httpPort, () => {
  console.log(`http listening on port ` + httpPort)
});

httpsServer.listen(httpsPort, () => {
  console.log('https listening on port ' + httpsPort)
});