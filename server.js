// Node.JS server with socket.io plugin for bidirectional event-based communcation
// Tobias Krauthoff <krauthoff@cs.uni-duesseldorf.de>

var port = 5001;
var mapIDtoSocket = {};
var mapNameToSocket = {};

var express = require('express');
var app = express();
var url = require('url');

var http = require('http');
var https = require('https');
var server = http.createServer(app);

server.listen(port);
var io = require('socket.io').listen(server);

// route
app.get('/publish', function(req, res){
    var params = getDictOfParams(req['url']);
    var dict = ''

    if (params['type'] == 'notification'){
        dict = { 'msg': params['msg'], 'type': 'notifications'}
    } else if (params['type'] == 'mention'){
        dict = { 'msg': params['msg'], 'type': 'mention', 'url': params['url']};
    } else if (params['type'] == 'edittext'){
        dict = { 'msg': params['msg'], 'type': 'edittext', 'url': params['url']};
    } else {
        res.writeHead(400);
        res.write('0');
        res.end();
        logMessage('  Unknown type: ' + params['type']);
        return;
    }

    try {
        if (dict != ''){
            mapIDtoSocket[params['socket_id']].emit('publish', dict);
            res.writeHead(200);
            res.write('1');
        }
    } catch (e) {
        logMessage('  No socket for socket_id ' + params['socket_id']);
        res.writeHead(400);
        res.write('0');
    }
    res.end();
});

// Event on connection
io.sockets.on('connection', function(socket){
    addClient(socket);
    socket.emit('subscribe', socket.id);

    socket.on('disconnect', function(){
        removeClient(socket);
    });
});

// Console logger
logMessage = function(msg){
    var time = new Date().today() + ' ' + new Date().timeNow();
    console.log(time + ' ' + msg);
};

// Add client to dictionary
addClient = function(socket){
    mapIDtoSocket[socket.id] = socket;
    logMessage('Added ' + socket.id + ' into dict');
};

// Remove client from dictionary
removeClient = function(socket){
    delete mapIDtoSocket[socket.id];
    logMessage('Removed ' + socket.id + ' from dict');
};

// Parses url
getDictOfParams = function(url){
    logMessage(url);
    var param = url.substr(url.indexOf('?')+1);
    var params = param.split('&');
    var dict = {};
    var split = '';
    params.forEach(function(entry) {
        split = entry.split('=');
        if (split[0] == 'socket_id')
            split[1] = '/#' + split[1];
        else if (split[0] == 'msg')
            split[1] = split[1].replace('%20', ' ');

        dict[split[0]] = split[1];
        logMessage('  Reading params: ' + split[0] + ' -> ' + split[1]);
    });
    return dict;
};

// For todays date;
Date.prototype.today = function () {
    return ((this.getDate() < 10)?"0":"") + this.getDate() + "."
        + (((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) + "."
        + this.getFullYear();
};

// For the time now
Date.prototype.timeNow = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours() + ":"
        + ((this.getMinutes() < 10)?"0":"") + this.getMinutes() + ":"
        + ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
};
