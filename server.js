// Node.JS server with socket.io plugin for bidirectional event-based communcation
// Tobias Krauthoff <krauthoff@cs.uni-duesseldorf.de>

var port = 5222;
var mapIDtoSocket = {};
var mapNameToSocket = {};
var version = '0.3.5'

var express = require('express');
var crypto = require('crypto');
var https = require('https');
var http = require('http');
var url = require('url');
var fs = require('fs');
var touch = require('touch');
var app = express();
app.set('port', port);
var path = '';

// read params
var is_global_mode = false;
var is_log_console = false;
var is_log_file = false;
var params = []

/*
 * Print help menu
 */
printHelp = function(){
    console.log('Usage: nodejs server.js [options]');
    console.log('');
    console.log('Options:')
    console.log('  -v,  --version      print version')
    console.log('  -g,  --global       run on global server with https and certificates')
    console.log('  -l,  --local        run on local machine with http and no certificates')
    console.log('  -lc, --logconsole   enable logging on console')
    console.log('  -lf, --logfile      enable logging in file')
    console.log('  -p,  --path         path of fullchain.pem and priveky.pem')
    console.log('')
    console.log('Without any options, the server will start locally without logging.')
    console.log('')
    console.log('Author: Tobias Krauthoff <krauthoff@cs.uni-duesseldorf.de>')
}

/*
 * Print error
 */
maliciousArgv = function(){
    console.log('Options are malicious!');
    console.log('');
    printHelp();
}

if (process.argv.indexOf('--help') != -1 || process.argv.indexOf('-h') != -1){
    printHelp();
    return;
}

for (var i = 2; i < process.argv.length; i += 1){
    should_die = false;
    switch(process.argv[i]){
        case '-v' || '--version':
            console.log('v0.2.0');
            return;
        case '-g' || '--global':
            is_global_mode = true;
            break;
        case '-l' || '--local':
            if (is_global_mode){
                maliciousArgv();
                return;
            }
            break;
        case '-lc' || '--logconsole':
            is_log_console = true;
            break;
        case '-lf' || '--logfile':
            is_log_file = true;
            break;
        case '-p' || '--path':
            path = process.argv[i+1];
            i+=1;
            break;
        default:
            maliciousArgv();
            should_die = true;
    }

    if (should_die)
        return;
}

console.log('Start server ' + version + ' with options:');
console.log('  mode: ' + (is_global_mode ? 'global' : 'local'));
console.log('  log:  ' + (is_log_console ? (is_log_file ? 'console, file' : 'console') : is_log_file ? 'file' : 'none'));
console.log('  path: ' + '\'' + path + '\'');
console.log('');

// *********************************************** /
// *            STARTING SERVER                  * /
// *********************************************** /

// start with https ot http
if (is_global_mode){
    var options = {};
    try{
        var options = {
            // Chain and key will be copied by /usr/local/sbin/le-renew-webroot
            //key:   fs.readFileSync('/etc/nginx/ssl/server.key'),
            //cert:  fs.readFileSync('/etc/nginx/ssl/server.crt'),
            //pfx:   fs.readFileSync('mycert.pfx'),
            //passphrase: 'sOmE_PassW0rd',
            cert:  fs.readFileSync(path + 'fullchain.pem'),
            key:   fs.readFileSync(path + 'privkey.pem')
        };
    } catch (err) {
        console.log('ERROR: Certificates could not be found!');
        console.log('       Starting without certificates!')
    }
    //var credentials = crypto.createCredentials({key: options['key'], cert: options['cert']});
    var server = https.createServer(options, app).listen(app.get('port'), function(){
        console.log('Express server listening with https on port ' + app.get('port'));
    });
} else {
    var server = http.createServer(app).listen(app.get('port'), function(){
        console.log('Express server listening with http on port ' + app.get('port'));
    });
}
var io = require('socket.io').listen(server);

// Read custom data of handshake
io.use(function(socket, next){
    logMessage('New connection from ' + socket.request.connection.remoteAddress + ' (socket.request.connection.remoteAddress)');
    logMessage('New connection from ' + socket.handshake.address + ' (socket.handshake.address)');
    // add mapping from name to socketid
    if (addNameToSocketId(socket) == -1){
        return;
    }
    return next();
});


// Event on connection
io.sockets.on('connection', function(socket){
    // add mapping from socketid to socket
    addIDtoSocket(socket);
    socket.emit('push_socketid', socket.id)

    // remove on disconnect
    socket.on('disconnect', function(){
        removeIDtoSocket(socket.id);
    });

    // remove on message
    socket.on('remove_name', function(name){
        removeNameToSocketId(name);
    });

    // remove on message
    socket.on('push_test', function(type, message){
        logMessage('Debugging ' + type + ' (' + message + ')');
        if (type == 'success')
            socket.emit('push_test', {type: 'success', msg: message});
        else if (type == 'danger')
            socket.emit('push_test', {type: 'warning', msg: message});
        else if (type == 'info')
            socket.emit('push_test', {type: 'info', msg: message});
        else
            socket.emit('push_test', {type: 'unknown', msg: message});
    });
});

// *********************************************** /
// *                  ROUTES                     * /
// *********************************************** /

// route
app.get('/publish', function(req, res){
    var params = getDictOfParams(req['url']);

    if (params == ''){
        writeResponse(res, 400, '0');
        logMessage('  Empty params!');
        return;
    } else if (params['type'] != 'success' &&
            params['type'] != 'info' &&
            params['type'] != 'warning'){
        writeResponse(res, 400, '0');
        logMessage('  Unknown type: \'' + params['type'] + '\'');
        return;
    }

    try {
        var socket_id = mapNameToSocket[params['nickname']];
        mapIDtoSocket[socket_id].emit('publish', params);
        writeResponse(res, 200, '1');
    } catch (e) {
        logMessage('  No socket for socket_id ' + params['socket_id'] + ': ' + e.message);
        writeResponse(res, 400, '0');
    }
});

app.get('/recent_review', function(req, res){
    var params = getDictOfParams(req['url']);

    if (params == ''){
        writeResponse(res, 400, '0');
        logMessage('  Empty params!');
        return;
    }

    try {
        io.emit('recent_review', params);
        writeResponse(res, 200, '1');
    } catch (e) {
        logMessage('  Could not broadcast: ' + e.message);
        writeResponse(res, 400, '0');
    }
});

// *********************************************** /
// *                 FUNCTIONS                   * /
// *********************************************** /

/**
 * Writes statuscode into the head and body into the body of the response
 * @param response response
 * @param statuscode int
 * @param body string
 */
writeResponse = function(response, statuscode, body){
    logMessage('  Write response with ' + statuscode + ' and body ' + body);
    response.writeHead(statuscode);
    response.write(body);
    response.end();
}

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
addNameToSocketId = function(socket){
    var name = socket.handshake.query.nickname;
    var socketid = socket.id;
    if (name.length == 0){
        logMessage('Empty name!');
        return -1;
    }
    mapNameToSocket[name] = socketid;
    logMessage('Added ' + name + ':' + socketid + ' into name dict');
    return 0;
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
    if (is_log_console || is_log_file)
        var time = new Date().today() + ' ' + new Date().timeNow();
    if (is_log_console)
        console.log(time + ' ' + msg);
    if (is_log_file){
        var path_for_log = 'log/server_' + new Date().todayForLog() + '.log';
        touch(path_for_log)
        fs.appendFile(path_for_log, time + ' ' + msg + '\n');
    }
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

// *********************************************** /
// *                EXTENIONS                    * /
// *********************************************** /

// Enhance the Date with a today function, which returns DD.MM.YYYY
Date.prototype.today = function () {
    return ((this.getDate() < 10)?"0":"") + this.getDate() + "."
        + (((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) + "."
        + this.getFullYear();
};

Date.prototype.todayForLog = function () {
    return this.getFullYear() +
        + (((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) +
        + ((this.getDate() < 10)?"0":"") + this.getDate();
};

// Enhance the Date with a today function, which returns HH:MM:SS
Date.prototype.timeNow = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours() + ":"
        + ((this.getMinutes() < 10)?"0":"") + this.getMinutes() + ":"
        + ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
};

// Enhance the Date with a today function, which returns YYYYMMDD_HHMMSS
Date.prototype.logNow = function () {
     return  this.getFullYear()
         + (((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) +
         + ((this.getDate() < 10)?"0":"") + this.getDate() + "_"
         + ((this.getHours() < 10)?"0":"") + this.getHours() +
         + ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +
         + ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
};
