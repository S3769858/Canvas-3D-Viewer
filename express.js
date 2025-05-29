const express = require('express');
const req = require('express/lib/request');
const fs = require('fs')
const app = express()
const http = require('http');
const https = require('https');
const httpPort = 5000;
const httpsPort = 4000;

app.use(express.static("./"))

app.use(express.urlencoded({extended: true}))

app.engine('html', require('ejs').renderFile);

app.post('/view/:modelName', (req, res) => {
  const modelName = req.params.modelName;
  console.log("view:" + modelName);
  res.render(__dirname + '/index.html', { modelName: modelName })
})


app.get('/view/:modelName', (req, res) => {
  const modelName = req.params.modelName;
  res.render(__dirname + '/index.html', { modelName });
});


app.get('/embed', (req, res) => {
  const url = req.query.ext_content_return_url || '';
  res.render(__dirname + '/select.html', { return_url: url });
});

app.post('/embed', (req, res) => {
  const url = req.body.ext_content_return_url;
  res.render(__dirname + '/select.html', { return_url: url });
})

app.get('/xml', (req, res) => {
  res.render(__dirname + "/info.xml");
})

app.get('/models', (req, res) => {
  const models = fs.readdirSync('./sample_models');
  res.send(models);
})

app.post('/submit/:modelName/:url', (req, res) => {
  const modelName = req.params.modelName;
  const url = req.params.url;
  console.log("submit:" + modelName);
  res.render(__dirname + '/submit.html', { modelName: modelName, return_url: url })
})

app.get('/submit/:modelName/:url', (req, res) => {
  const { modelName, url } = req.params;
  res.render(__dirname + '/submit.html',
             { modelName, return_url: url });
});

app.all('/submit/:modelName', (req, res) => {
  const name = req.params.modelName.replace(/\.[^/.]+$/, '').toLowerCase();
  res.redirect('/view/' + name);
});


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