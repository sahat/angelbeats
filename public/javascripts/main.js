var socket = io.connect(window.location.href);

$(document).ready(function() {

  $('#song-count').text($('.track').length + ' tracks')

  // Get total time
  var total = 0;
  $('.time').each(function(index) {
    total += $(this).data('time');
  });
  var time = moment.duration({s: total });
  var hours = ' hours ';
  var minutes = ' minutes';

  if (time.hours() === 1) hours = ' hour ';
  if (time.minutes() === 1) minutes = ' minute';

  $('#total-time').text(time.hours() + hours + time.minutes() + minutes);

  /**
   * Socket.io and stuff.
   */


  socket.on('connect', function() {

    if (localStorage.getItem('isHost')) {
      socket.emit('hostComeback', this.socket.sessionid);
      socket.emit('checkIfHost', this.socket.sessionid);
    }


    socket.emit('checkIfHost', this.socket.sessionid);
    socket.on('checkIfHostAnswer', function(isHost) {
      if (!isHost) {
        console.log('You are not a host');
        $('#play').unbind('click');
        $('.track').unbind('dblclick');
        $('#pause').unbind('click');
        $('#forward').unbind('click');
        $('#backward').unbind('click');
        $('.guest-mode').show();
      } else {
        console.log('Yes you are a host');
        $('.host-mode').show();
        localStorage.setItem('isHost', true);

        // If host, set localstorage variable isHost = true
        // When disconnected, check on server if host is disconnected.
        // If it is, create a 60 sec timeout, after which hostId is next socket in line
        // If host comes back within 60 sec, clear the timeout

      }
    });

  });


  var latency;
  var latencyInterval;
  var isPlaying = false;
  var startTime;
  var latencyArray = [];

  var $track = $('.track');
  var $playlistControls = $('.playlist-controls');
  var $sync = $('.sync');
  var $highlight = $('.highlight');

  socket.on('pong', function() {
    latency = Date.now() - startTime;
    latencyArray.push(latency);
    $('.sync').text('Ping: ' + latency + ' ms');
  });

  socket.on('everyone_ping', function() {
    latencyInterval = setInterval (function() {
      startTime = Date.now();
      socket.emit('ping');
    }, 10);
  });

  $track.dblclick(function (e) {

    // Cleanup service
    $('audio').remove();
    $playlistControls.removeClass('fadeInDown animated');


    // Prevent playback of the same track that is currently playing
    if ($(e.target).parent().hasClass('highlight')) {
      return;
    }

    isPlaying = true;

    $sync.show();

    // Highlight current track when user double clicks on it
    if (e.originalEvent !== undefined) {
      $highlight.removeClass('highlight');
      $(this).addClass('highlight');
    }

    // Pause currently playing track first
    socket.emit('pause');

    // update ping
    socket.emit('startping');


    // Step 2
    // Tell server that we want to play a song, by passing a track id.
    // Start with a 0.5s delay to give time for synchronization.
    var self = this;
    setTimeout(function() {
      console.log('initiating play');

      socket.emit('initiatePlay', {
        id: $(self).find('.id').text(),
        file: $(self).find('.file').text(),
        name: $(self).find('.name').text(),
        time: $(self).find('.time').text(),
        artist: $(self).find('.artist').text(),
        album: $(self).find('.album').text(),
        genre: $(self).find('.genre').text()
      });

    }, 1000);
  });


  // Step 3
  // Start playing with the latency offset.
  // This happens after server receives initiatePlay event
  socket.on('beginPlaying', function (data) {
    console.log('Begin Playing');
    // No longer need to show synchronizing.. message
    $('.sync').hide();

    // Find track by id and add highlight class for other clients
    $('.highlight').removeClass('highlight');
    $('.id:contains(' + data.id + ')').first().parent().addClass('highlight');

    $('.playlist-controls').text(data.name);
    $('.playlist-controls').addClass('fadeInDown animated');


    var player = '<audio class="player">' +
      '<source src="/uploads/' + data.file + '" type="audio/mpeg">' +
      '</audio>';


    $(player).insertAfter('#playlist');
    var audio = $('.player').get(0);

    function updateProgress() {
      var value = 0;
      if (audio.currentTime > 0) {
        // value = Math.floor((100 / audio.duration) * audio.currentTime);

        var time = moment.duration({s: audio.currentTime });
        var prettyTime = moment().startOf('day').add(time).format('m:ss');
        $('#currentTime').text(prettyTime);
      }

      var time2 = moment.duration({s: audio.duration });
      var prettyTime2 = moment().startOf('day').add(time2).format('m:ss');
      $('#timeLeft').text(prettyTime2);

      // $trackProgressBar.css('width', value + '%');
    }

    audio.addEventListener('timeupdate', updateProgress, false);

    console.log('starting music now...');

    var averageLatency;
    var total = 0;

    for (var i = 0; i < latencyArray.length; i++) {
      total += latencyArray[i];
    }

    averageLatency = total / latencyArray.length;

    console.log('Average: ' + averageLatency);

    audio.addEventListener('canplaythrough', function() {
      console.log('loaded audio metadata');
      this.currentTime = Math.ceil(averageLatency/1000);

      // Start music playback here with the latency offset
      setTimeout(function() {
        console.log('PLAYING!!!!');
        audio.play();
      }, averageLatency);
    });




    clearInterval(latencyInterval);

    console.log('cleared interval');
  });

  $('#play').click(function(player) {
    if (isPlaying) {
      return;
    }
    $('.track').first().trigger('dblclick');
  });


  $('#pause').click(function () {
    isPlaying = false;
    clearInterval(latencyInterval);
    socket.emit('pause');
  });

  $('#forward').click(function() {
    if (isPlaying) {
      $('.highlight').next().trigger('dblclick');
    }
  });

  $('#backward').click(function() {
    if (isPlaying) {
      $('.highlight').prev().trigger('dblclick');
    }
  });




// Display number of connected users
  socket.on('count', function (data) {
    // clear everything in the dropdown menu
    $('.connected-counter ul.dropdown-menu').html('');
    for (var i = 0; i < data.clients.length; i++) {
      var client = data.clients[i];
      console.log(client)
      $('.connected-counter ul.dropdown-menu').append('<li>' + client.address.address + '</li>')
    }
    console.log(data.clients);
    $('#numberOfClients').hide().fadeIn(200).text(data.numberOfClients);
  });

// Pause currently playing track.
  socket.on('halt', function (data) {
    $.each($('audio'), function () {
      this.pause();
    });
  });

  /**
   * Table List
   * @type {{valueNames: string[]}}
   */
  var options = {
    valueNames: ['id', 'name', 'time', 'artist', 'album', 'genre']
  };

  // Init list
  var playlist = new List('playlist', options);

  $('.search').keyup(function() {
    playlist.search($(this).val());
  });

  /**
   * File Upload
   */

  var $progrecss = $('.progrecss');

  $('#fileupload').fileupload({
    dataType: 'json',
    submit: function(event, data) {
      $progrecss.fadeIn(200)
    },
    stop: function() {
      $progrecss
        .delay(1500)
        .fadeOut(800)
        .queue(function(next) {
          $(this).attr('data-progrecss', 0);
          next();
        });
    },
    progressall: function (event, data) {
      var progress = parseInt(data.loaded / data.total * 100, 10);
      $progrecss.attr('data-progrecss', progress);
    }
  });

  /**
   * Convert track duration in secs to m:ss format
   * E.g. 187 to 3:07
   */
  $('.time').each(function(index) {
    var time = moment.duration({s: $(this).text() });
    var prettyTime = moment().startOf('day').add(time).format('m:ss')
    $(this).text(prettyTime);
  });

});


