console.log('Starting...');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var io = require('socket.io')(server);
var fs = require('fs');

var config = fs.readFileSync('./login.conf','utf8');
var username = process.env.USERNAME || config.split(':')[0];
var password = process.env.PASSWORD || config.split(':')[1];
server.listen(Number(process.env.PORT || 5555));
var options = {
	appkeyFile: './appkey.key',
	cacheFolder: 'cache',
	settingsFolder: 'settings'
};
var spotify = require('./node_modules/node-spotify/build/Release/spotify')(options);
var queue = [];
var paused = false;
var loggedIn = false;
var playingFromPlaylist = false;

var processURI = function(request)
{
	spotify.player.stop();
	endOfTrack();
};

var endOfTrack = function()
{
    console.log('End of track reached');
	delete spotify.currentTrack;
	if(queue.length > 0)
	{
		uri = queue.shift();
		console.log('got request to play ' + uri);
		var request = spotify.createFromLink(uri);
		if(!request)
		{
			var search = new spotify.Search(uri);
    		search.execute( function(err, searchResult)
			{
				if(err) console.log(err);
    			if(searchResult)
				{
					var track = searchResult.tracks[0];
					spotify.currentTrack = track;
					console.log('playing from search: ' + track.artists[0].name + ' - ' + track.name);
					spotify.player.play(track);
				}
			});
		}
		else if(request.name !== "Loading...")
		{
			if (request.popularity) // It's a track.
			{
				spotify.currentTrack = request;
				console.log('playing request: ' + request.artists[0].name + ' - ' + request.name);
				spotify.player.play(request);
			}
			else if(request.numTracks) // It's a playlist
			{
				playingFromPlaylist = request;
				endOfTrack();
			}
			else
			{
				socket.emit('error', 'Invalid URI');
			}
		}
		else
		{
			console.log('Delaying request. This may not work.');
			spotify.waitForLoaded([request], processURI);
		}
	}
	else if(playingFromPlaylist)
	{
		playRandomPlaylistTrack();
	}
};

spotify.player.on({
    endOfTrack: endOfTrack
});

io.on('connection', function(socket)
{
	if(!loggedIn)
	{
		spotify.login(username, password, false, false);
		loggedIn = true;
	}
	socket.on('stop', function()
	{
		delete spotify.currentTrack;
		queue = [];
		playingFromPlaylist = false;
		spotify.player.stop();
	});

	socket.on('pause', function()
	{
		if(paused)
		{
			spotify.player.resume();
			paused = false;
		}
		else
		{
			spotify.player.pause();
			paused = true;
		}
	});
	
	socket.on('next', function()
	{
		spotify.player.stop();
		endOfTrack();
	});
	
	socket.on('queue', function(uri)
	{
		queue.push(uri);
	});
	
	socket.on('queuenext', function(uri)
	{
		queue.unshift(uri);
	});

	socket.on('play', function(uri)
	{
		console.log('got request to play ' + uri);
		var request = spotify.createFromLink(uri);
		if(!request)
		{
			var artistSearch = false;
			if(uri.toUpperCase().lastIndexOf('(ARTIST) ', 0) === 0)
			{
				artistSearch = true;
				uri = uri.substring(9);
				console.log('searching artists for ' + uri);
			}
			var search = new spotify.Search(uri);
    		search.execute( function(err, searchResult)
			{
				if(err) console.log(err);
    			if(searchResult)
				{
					if(artistSearch)
					{
						var artist = searchResult.artists[0];
						artist.browse(spotify.constants.ARTISTBROWSE_FULL, function(err, browsedArtist)
						{
							console.log('playing from ' + artist.name);
							playingFromPlaylist = browsedArtist;
							endOfTrack();
						});
					}
					else
					{
						var track = searchResult.tracks[0];
						spotify.currentTrack = track;
						console.log('playing from search: ' + track.artists[0].name + ' - ' + track.name);
						spotify.player.play(track);
					}
				}
			});
		}
		else if(request.name !== "Loading...")
		{
			if (request.popularity) // It's a track.
			{
				spotify.currentTrack = request;
				console.log('playing request: ' + request.artists[0].name + ' - ' + request.name);
				spotify.player.play(request);
			}
			else if(request.numTracks) // It's a playlist
			{
				playingFromPlaylist = request;
				playRandomPlaylistTrack();
			}
			else
			{
				socket.emit('error', 'Invalid URI');
			}
		}
		else
		{
			console.log('Delaying request. This may not work.');
			spotify.waitForLoaded([request], processURI);
		}
	});
});

function playRandomPlaylistTrack()
{
	if(playingFromPlaylist)
	{
		if(playingFromPlaylist.numTracks)
		{
			var track = playingFromPlaylist.getTrack(Math.floor(Math.random() * playingFromPlaylist.numTracks));
		}
		else if(playingFromPlaylist.tophitTracks)
		{
			var track = playingFromPlaylist.tophitTracks[(Math.floor(Math.random() * playingFromPlaylist.tophitTracks.length))];
		}
		console.log('playing from playlist: ' + track.artists[0].name + ' - ' + track.name);
		try
		{
			spotify.player.play(track);
			spotify.currentTrack = track;
		} catch(e) { delete spotify.currentTrack; }
	}
}

setInterval(function()
{
	var res = "Nothing";
	if(spotify.currentTrack)
	{
		res = spotify.currentTrack.artists[0].name + ' - ' + spotify.currentTrack.name;
	}
	io.sockets.emit('nowplaying', res);
}, 1000);

var routes = require('./routes/index');
var users = require('./routes/users');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

console.log('Listening...');

module.exports = app;
