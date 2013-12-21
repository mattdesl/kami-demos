var domready = require('domready');
var base = require('../base');
var fs = require('fs');

domready(function() {
    //Here is where we query the GLSL source
    //We use a browserify transform to decouple them from our JS/HTML source code
    //But the build step will inline them into our JS, so there are no extra HTTP requests
    var vert = fs.readFileSync( __dirname + '/spotlight.vert' )
    var frag = fs.readFileSync( __dirname + '/spotlight.frag' )

    //run the base example
    base(vert, frag);
});