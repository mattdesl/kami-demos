var domready = require('domready');
var base = require('../base');

domready(function() {
    //Here is where we query the GLSL source
    var vert = document.getElementById("vert_shader").innerHTML;
    var frag = document.getElementById("frag_shader").innerHTML;

    //run the base example
    base(vert, frag);
});