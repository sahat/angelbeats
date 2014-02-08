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


});