console.log("loading extension");

var script = document.createElement('script');
script.textContent = 'openInBackground = ' + function(url) {
    console.log("open url " + url);
    window.postMessage({ type: "FROM_PAGE", url: url }, "*");
};
(document.head||document.documentElement).appendChild(script);


var port = chrome.runtime.connect({ name: "background-tab" });
window.addEventListener("message", function(event) {
    if (event.source != window) return; // We only accept messages from ourselves
    if (event.data.type && (event.data.type == "FROM_PAGE")) {
	console.log("Content script received: " + event.data.url);
	port.postMessage(event.data);
	console.log("send message done");
    }
}, false);

console.log("extension loaded");


