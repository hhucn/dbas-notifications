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

// Read custom data of handshake
io.use(function(socket, next){
    // add mapping from name to socketid
    addNameToSocket(socket.handshake.query.nickname, socket.id)
    return next();
});

// Event on connection
io.sockets.on('connection', function(socket){
    // add mapping from socketid to socket
    addIDtoSocket(socket);
    socket.emit('testid', socket.id)

    // remove on disconnect
    socket.on('disconnect', function(){
        removeIDtoSocket(socket.id);
    });

    // remove on message
    socket.on('remove_name', function(name){
        removeNameToSocket(name);
    });

    // remove on message
    socket.on('test', function(type){
        logMessage('Debugging ' + type);
        if (type == 'success')
            socket.emit('test', {type: 'success', msg: 'some success message'});
        else if (type == 'danger')
            socket.emit('test', {type: 'warning', msg: 'some warning message'});
        else if (type == 'info')
            socket.emit('test', {type: 'info', msg: 'some info message'});
        else
            socket.emit('test', {type: 'unknown', msg: 'some unknown message'});
    });
});

// route
app.get('/publish', function(req, res){
    var params = getDictOfParams(req['url']);
    var dict = ''

    if (params['type'] == 'notification'){ // notifications
        dict = { 'msg': params['msg'], 'type': 'notifications'}
    } else if (params['type'] == 'mention'){ // user was mentioned
        dict = { 'msg': params['msg'], 'type': 'mention', 'url': params['url']};
    } else if (params['type'] == 'edittext'){ // text was edited
        dict = { 'msg': params['msg'], 'type': 'edittext', 'url': params['url']};
    } else { // everything else
        res.writeHead(400);
        res.write('0');
        res.end();
        logMessage('  Unknown type: ' + params['type']);
        return;
    }

    try {
        if (dict != ''){
            var socket_id = mapNameToSocket[params['nickname']];
            mapIDtoSocket[socket_id].emit('publish', dict);
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

// Console logger
logMessage = function(msg){
    var time = new Date().today() + ' ' + new Date().timeNow();
    console.log(time + ' ' + msg);
};

// Add socketid of client to dictionary
addIDtoSocket = function(socket){
    mapIDtoSocket[socket.id] = socket;
    logMessage('Added ' + socket.id + ' into socketid dict');
};

// Remove socketid of client from dictionary
removeIDtoSocket = function(socket_id){
    delete mapIDtoSocket[socket_id];
    logMessage('Removed ' + socket_id + ' from socketid dict');
};

// Add name of client to dictionary
addNameToSocket = function(name, socketid){
    mapNameToSocket[name] = socketid;
    logMessage('Added ' + name + ':' + socketid + ' into name dict');
};

// Remove name of client from dictionary
removeNameToSocket = function(name){
    logMessage('Removed ' + name + ':' + mapNameToSocket[name] + ' from name dict');
    delete mapNameToSocket[name];
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
            split[1] = split[1].replace(/\%20/g, ' ');

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
