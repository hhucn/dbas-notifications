// Node.JS server with socket.io plugin for bidirectional event-based communcation
// Tobias Krauthoff <krauthoff@cs.uni-duesseldorf.de>

const port = 5001;
const mapIDtoSocket = {};
const mapNameToSocket = {};

const express = require('express');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const app = express();

// read params
var is_global_mode = false;
if (process.argv.length != 3){
    console.log('Please set an option: --global (-g), --local (-l)');
    return;
} else {
    if (process.argv[2] == '--global' || process.argv[2] == '-g'){
        console.log('Start global mode...');
        is_global_mode = true
    } else if (process.argv[2] != '--local' && process.argv[2] != '-l'){
        console.log('Your parameter was incorre.t Please set an option: ---global (-g), --local (-l)');
        return;
    } else {
        console.log('Start local mode...');
    }
}

// start with https ot http
if (is_global_mode){
    const options = {
        // Chain and key will be copied by /usr/local/sbin/le-renew-webroot
        //key:   fs.readFileSync('/etc/nginx/ssl/server.key'),
        //cert:  fs.readFileSync('/etc/nginx/ssl/server.crt'),
        //pfx:   fs.readFileSync('mycert.pfx'),
        //passphrase: 'sOmE_PassW0rd',
        cert:  fs.readFileSync('fullchain.pem'),
        key:   fs.readFileSync('privkey.pem')
    };
    //const credentials = crypto.createCredentials({key: options['key'], cert: options['cert']});
    var server = https.createServer(options, app).listen(port);
} else {
    var server = http.createServer(app).listen(port);
}
const io = require('socket.io').listen(server);

// Read custom data of handshake
io.use(function(socket, next){
    // add mapping from name to socketid
    addNameToSocketId(socket.handshake.query.nickname, socket.id)
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
        removeNameToSocketId(name);
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

/**
 * Add socketid of client to dictionary
 * @param socket Socket
 */
addIDtoSocket = function(socket){
    mapIDtoSocket[socket.id] = socket;
    logMessage('Added ' + socket.id + ' into socketid dict');
};

/**
 * Remove socketid of client from dictionary
 * @param socket_id integer
 */
removeIDtoSocket = function(socket_id){
    delete mapIDtoSocket[socket_id];
    logMessage('Removed ' + socket_id + ' from socketid dict');
};

/**
 * Add name of client to dictionary
 * @param name String
 * @param socketid integer
 */
addNameToSocketId = function(name, socketid){
    mapNameToSocket[name] = socketid;
    logMessage('Added ' + name + ':' + socketid + ' into name dict');
};

/**
 * Remove name of client from dictionary
 * @param name String
 */
removeNameToSocketId = function(name){
    logMessage('Removed ' + name + ':' + mapNameToSocket[name] + ' from name dict');
    delete mapNameToSocket[name];
};

/**
 * Console logger
 * @param msg String
 */
logMessage = function(msg){
    var time = new Date().today() + ' ' + new Date().timeNow();
    console.log(time + ' ' + msg);
};

/**
 * Parses url
 * @param url String
 * @return dictionary
 */
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

// Enhance the Date with a today function, which returns DD.MM.YYYY
Date.prototype.today = function () {
    return ((this.getDate() < 10)?"0":"") + this.getDate() + "."
        + (((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) + "."
        + this.getFullYear();
};

// Enhance the Date with a today function, which returns HH:MM:SS
Date.prototype.timeNow = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours() + ":"
        + ((this.getMinutes() < 10)?"0":"") + this.getMinutes() + ":"
        + ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
};
