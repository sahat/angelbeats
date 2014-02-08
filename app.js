
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var Sequelize = require('sequelize');
var upload = require('jquery-file-upload-middleware');

if (process.env.HEROKU_POSTGRESQL_GOLD_URL) {
  var match = process.env.HEROKU_POSTGRESQL_GOLD_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
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
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(sass.middleware({ src: path.join(__dirname, 'public') }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
