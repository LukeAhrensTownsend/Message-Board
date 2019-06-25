var posts = document.getElementsByClassName("post");

window.onload = function() {
    for (var i = 0; i < posts.length; i++) {
        var timestampField = posts[i].getElementsByClassName("timestamp-field")[0];
        var timestamp = new Date(parseInt(timestampField.innerHTML));

        timestampField.innerHTML = timestamp.toDateString() + " - " + timestamp.toTimeString().substring(0, 17);
    }
};