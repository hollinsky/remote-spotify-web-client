The Remote Spotify Web Client
=====================

If you've ever wanted to set up a music player controlled by a phone or computer that plays Spotify music through the server's speakers, this is for you.

To set it up, you need to input the login credentials of a Spotify Premium account into the login.conf file, and run `npm install` to get the dependencies. This will, of course, require that you've installed Node.JS. Also, due to limitations with libspotify, this only runs on OSX and Linux based servers, NOT Windows ones. Then just run launch.sh and you're ready to go.

To access it, go to port 5555 of the server in your web browser. You can set the port by launching it with the PORT environment variable set as you like.

The interface is straightforward and simple. Input a track name, and it will play a track. Input the Spotify URI of a specific track, and it will play it. Throw an artist name at it, and it will start playing a playlist of hits from that artist. Throw a playlist URI at it, and it will shuffle through that playlist. If you run into any trouble with it, pressing the stop button basically resets the server and UI.

I'd be happy to see pull requests or changes made to this, so feel free to submit them.

Paul Hollinsky 2014