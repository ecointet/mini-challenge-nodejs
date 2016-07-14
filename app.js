var http = require('http');
var amqp = require('amqp');
var URL = require('url');
var htmlEscape = require('sanitizer/sanitizer').escape;

function rabbitUrl() {
  if (process.env.VCAP_SERVICES) {
    var svcInfo = JSON.parse(process.env.VCAP_SERVICES);
    for (var label in svcInfo) {
      var svcs = svcInfo[label];
      for (var index in svcs) {
        var uri = svcs[index].credentials.uri;
        if (uri.lastIndexOf("amqp", 0) == 0) {
          return uri;
        }
      }
    }
    return null;
  }
  else {
    return "amqp://localhost";
  }
}

var port = process.env.VCAP_APP_PORT || 3000;

var messages = [];

function setup() {

  var exchange = conn.exchange('hackathon', {'type': 'fanout', durable: true}, function() {

    var queue = conn.queue('', {durable: false, exclusive: true},
    function() {
      queue.subscribe(function(msg) {
        messages.push(htmlEscape(msg.body));
          /*
        if (messages.length > 5) {
          messages.shift();
        }
        */
      });
      queue.bind(exchange.name, '');
    });
    queue.on('queueBindOk', function() { httpServer(exchange); });
  });
}

function httpServer(exchange) {
  var serv = http.createServer(function(req, res) {
  var url = URL.parse(req.url);


    if (req.method == 'GET' && url.pathname == '/env') {
      printEnv(res);
    }
    else if (req.method == 'GET' && url.pathname == '/') {
      res.statusCode = 200;
      openHtml(res);
        writeForm(res);
      writeMessages(res);
      closeHtml(res);
    }
    else if (req.method == 'GET' && url.pathname == '/noform') {
        res.statusCode = 200;
        //openHtml(res);
        writeMessages(res);
        res.end();
    }
    else if (req.method == 'POST' && url.pathname == '/') {
      chunks = '';
      req.on('data', function(chunk) { chunks += chunk; });
      req.on('end', function() {
        msg = unescapeFormData(chunks.split('=')[1]);
        exchange.publish('', {body: msg});
        res.statusCode = 303;
        res.setHeader('Location', '/');
        res.end();
      });
    }
    else {
      res.statusCode = 404;
      res.end("This is not the page you were looking for.");
    }
  });
  serv.listen(port);
}

console.log("Starting ... AMQP URL: " + rabbitUrl());
var conn = amqp.createConnection({url: rabbitUrl()});
conn.on('ready', setup);

// ---- helpers

function openHtml(res) {
  res.write("<html><head><title>Hackathon Challenge!</title></head><body>");
  //res.write('<link rel="stylesheet" type="text/css" href="theme.css" />');
//res.write('<div align="center"><img src="http://hp.cointet.com/HPE.png" /></div>');
  //res.write('<div align="center"><h1>- My HPE Chat -</h1></div>');
}

function closeHtml(res) {
  res.end("</body></html>");
}

function writeMessages(res) {
 // res.write('<h2>Messages:</h2>');
 // res.write('<ol>');
    classement = 0;
    for (i in messages) {

        classement++;
        res.write(classement.toString() + ") " + messages[i] + '<br>');
  }
 // res.write('</ol>');
}

function writeForm(res) {
  res.write('<form method="post">');
  res.write('<input name="data"/><input type="submit"/>');
  res.write('</form>');
}

function printEnv(res) {
  res.statusCode = 200;
  openHtml(res);
  for (entry in process.env) {
    res.write(entry + "=" + process.env[entry] + "<br/>");
  }
  closeHtml(res);
}

function unescapeFormData(msg) {
  return unescape(msg.replace('+', ' '));
}
