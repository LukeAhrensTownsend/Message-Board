var form = document.getElementById("message-form");
var messageArea = document.getElementById("message-area");
var span = document.getElementById("char-remaining");
var maxlength = 750;

function updateCharRemaining(event) {
    if (event.keyCode === 13) form.submit();
    
    setTimeout(function() {
        span.innerHTML = maxlength - messageArea.value.length;
    }, 10);
}
