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

});