# What is this

This extension injects the function `openInBackground` into the current tab.
This function can be used as alternative to `window.open`, only that it opens
the new URL in a **background** tab, i.e. does not switch immediately to it.

This is useful for a workflow with RSS reader, where one first goes through all
the listed items and opens all interesting ones in the background for later
reading, then marks the item list as completed.

# Installation

The `content_scripts.matches` setting in `manifest.json` should be adapted to
cover all URL where this extension should be used. Right now it only covers
`http://localhost:3000`, i.e. the default URL for locally running the RSS
reader. It is a very bad idea to simply inject this extension into every URL.

The extension then need to be loaded into the browser. With Firefox this can be
done through `about:debugging`, while Chrome can load the extension simply as
"Load unpacked" when Developer Mode is on. With Firefox the extension need to be
manually loaded again on each restart, with Chrome it stays until explicitly
disabled or removed.

