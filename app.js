
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var mm = require('musicmetadata');
var Sequelize = require('sequelize');
var upload = require('jquery-file-upload-middleware');
//var sass = require('node-sass');
var fs = require('fs');
var _ = require('lodash');

if (process.env.HEROKU_POSTGRESQL_CRIMSON_URL) {
  var match = process.env.HEROKU_POSTGRESQL_CRIMSON_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  var sequelize = new Sequelize(match[5], match[1], match[2], {
    dialect: 'postgres',
    protocol: 'postgres',
    port: match[4],
    host: match[3],
    logging: true
  });
} else {
  sequelize = new Sequelize('test', 'root', 'pass');
}

var Track = sequelize.define('Track', {
  file: { type: Sequelize.STRING, unique: true },
  name: { type: Sequelize.STRING },
  time: { type: Sequelize.INTEGER },
  artist: { type: Sequelize.STRING },
  album: { type: Sequelize.STRING },
  genre: { type: Sequelize.STRING }
});

sequelize
  .sync()
  .complete(function(err) {
    if (err) {
      console.log('✗ Error occurred while creating the table:', err)
    } else {
      console.log('✓ Sequelize Sync Complete')
    }
  });

upload.configure({
  uploadDir: __dirname + '/public/uploads',
  uploadUrl: '/uploads'
});

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use('/upload', upload.fileHandler());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
//app.use(sass.middleware({ src: path.join(__dirname, 'public') }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.errorHandler());
app.use(function(req, res, next){
  if (req.path.indexOf('uploads') !== -1) {
    // 404 on /uploads/filename
    var track404 = req.path.split('/').slice(-1)[0];
    Track.find({ where: { file: track404 } })
      .success(function (track) {
        if (track) {
          track.destroy()
            .success(function() {
              console.log('deleted - ', track404);
              return res.send( { message: 'Track no longer exists' });
            });
        }
      });
  }
  console.log('404');
  res.send(404, 'Sorry cant find that!');
});

upload.on('error', function (err) {
  if (err) return console.log(err);
});

upload.on('abort', function (fileInfo) {
  console.log('Abborted upload of ' + fileInfo.name);
});

upload.on('end', function (fileInfo) {
  console.log('finished');

  var filePath = path.join(__dirname, 'public', 'uploads', fileInfo.name);

  console.log(fileInfo.name)
  console.log(fileInfo.originalName)
  if (fileInfo.name !== fileInfo.originalName) {
    console.log('dup file');
  } else {
    console.log('new file');

    console.log('Getting metadata...');

    var parser = mm(fs.createReadStream(filePath), { duration: true });

    parser.on('metadata', function(meta) {
      console.log('ON META!===')

      Track
        .sync()
        .on('success', function () {
          Track.create({
            file: fileInfo.name,
            name: meta.title,
            time: meta.duration,
            artist: _.first(meta.artist),
            album: meta.album,
            genre: _.first(meta.genre)
          })
            .success(function (track, created) {
              console.log('Successfully created a new track');
            })
            .error(function (err) {
              console.log(err);
            })
        });
    });

    parser.on('error', function(err) {
      console.log('Oops:', err.message)
    });
  }

});

app.get('/', function (req, res) {

  Track
    .sync()
    .on('success', function () {
      Track
        .findAll()
        .success(function (tracks) {
          res.render('index', {
            playlist: tracks
          });
        });
    })
    .on('error', function (err) {
      res.send(500, err);
    });

});


var io = require('socket.io').listen(app.listen(app.get('port')));

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 1);

io.configure(function () {
  io.set('transports', ['websocket']);
});

var clients = [];
var connectedClients = 0;
var hostId;
var hostTimeout;

io.sockets.on('connection', function (socket) {

  if (connectedClients < 1) {
    console.log(socket.id);
    console.log('----host!-----------')
    hostId = socket.id;
  }

  socket.on('hostComeback', function(newHostId) {
    hostId = newHostId;
    clearTimeout(hostTimeout);
  });

  // As of socket.io 1.0 to get an IP address changes to:
  //  socket.request.connection.remoteAddress
  clients.push({
    socketId: socket.id,
    address: socket.handshake.address
  });

  // Increment client count
  connectedClients++;

  socket.on('checkIfHost', function (clientId) {
    console.log(clientId);
    socket.emit('checkIfHostAnswer', clientId === hostId);
  });

  io.sockets.emit('count', {
    clients: clients,
    numberOfClients: connectedClients
  });

  socket.on('initiatePlay', function (data) {
    console.log(data);
    io.sockets.emit('beginPlaying', data);
  });

  socket.on('startping', function() {
    io.sockets.emit('everyone_ping');
  });

  socket.on('ping', function () {
    socket.emit('pong');
  });

  socket.on('pause', function () {
    io.sockets.emit('halt', 'maestro stop playing!');
  });

  socket.on('disconnect', function() {
    if (socket.id == hostId) {
      console.log('host has left');
      hostTimeout = setTimeout(function() {
        console.log('deleting host in 60sec')
        hostId = null;
      }, 60000);
    }

    connectedClients--;
    // pop client from the array
    clients = _.without(clients, _.findWhere(clients, { socketId: socket.id }));

    io.sockets.emit('count', {
      clients: clients,
      numberOfClients: connectedClients
    });
  });

});

process.on('exit', function() {
  console.log('bye...');
  Track.drop();
});

process.on('uncaughtException', function (err) {
  console.error(err);
  Track.drop()
    .success(function() {
      process.exit();
    });
});