var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;

var SpriteBatch = require('kami').SpriteBatch;
var FrameBuffer = require('kami').FrameBuffer;
var TextureRegion = require('kami').TextureRegion;
var ShaderProgram = require('kami').ShaderProgram;

//include polyfill for requestAnimationFrame
require('raf.js');

var fs = require('fs');

domready(function() {
    //create our WebGL context
    var context = new WebGLContext(500, 500);
    document.body.appendChild(context.view);

    var batch = new SpriteBatch(context);
    
    function render() {
        requestAnimationFrame(render);
        var gl = context.gl;

        //clear the screen
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        
    }

    requestAnimationFrame(render);
});