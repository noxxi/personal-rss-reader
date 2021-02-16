chrome.runtime.onConnect.addListener( function(port) {
    console.log("content script connected " + port);
    port.onMessage.addListener( function(r) {
	console.log(r);
	chrome.tabs.create({
	    active: false,
	    // selected: false,
	    url: r.url
	});
    })
});
