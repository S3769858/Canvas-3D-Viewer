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

app.post('/select/:modelName', (req, res) => {
  const modelName = req.params.modelName;
  const formData = new FormData();

  formData.append('lti_message_type', 'ContentItemSelection');
  formData.append('lti_version', 'LTI-1p0');
  formData.append('content_items', '{'
    +' "@context": "http://purl.imsglobal.org/ctx/lti/v1/ContentItem",'
    +' "@graph": [ {'
    +' "@type": "LtiLinkItem",'
    //+' "url": "http://localhost:5000/' + modelName + '",'
    +' "url": "http://localhost:5000/",'
    +' "mediaType": "application/vnd.ims.lti.v1.ltilink",'
    +' "text": "3D Model Viewer",'
    +' "placementAdvice": {'
    +' "presentationDocumentTarget": "iframe",'
    +' "displayWidth": 800,'
    +' "displayHeight": 600'
    +' } } ]'
    +' }'
  )

  try {
    const response = fetch("http://172.18.0.6:80/courses/5/external_content/success/external_tool_dialog", {
      method: "POST",
      // Set the FormData instance as the request body
      body: formData,
    });
  } catch (e) {
    console.error(e);
  }
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