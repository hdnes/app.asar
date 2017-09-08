function LiveVideo(selector, file) {
    this.plugin = document.querySelector(selector);
    this.url = "ws://localhost:19870/controller/live_video/" + file;
}

LiveVideo.prototype.getVideo = function() {
    this.plugin.postMessage('o;' + this.url)
}

LiveVideo.prototype.removeVideo = function() {
    this.plugin.postMessage('c;')
}