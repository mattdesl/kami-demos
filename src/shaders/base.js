//Since both brfs and script-tag demos use the same
//source, we can just define it here and require it

//include requestAnimationFrame polyfill
require('raf.js');

//kami includes
var WebGLContext  = require('kami').WebGLContext;
var Texture       = require('kami').Texture;
var SpriteBatch   = require('kami').SpriteBatch;
var ShaderProgram = require('kami').ShaderProgram;

//This should only be called once DOM has been loaded
module.exports = function(vertSrc, fragSrc) {
    var canvas = document.createElement("canvas");
    
    document.body.appendChild(canvas);    
    
    canvas.width = 150;
    canvas.height = 150;

    var context = new WebGLContext(canvas.width, canvas.height, canvas);

    //we will use SpriteBatch for simple quad rendering
    var batch = new SpriteBatch(context);   

    //since we are using SpriteBatch, it expects a texture
    //in our case we'll just use an empty transparent 1x1 texture.
    //Our shader will do all the pixel drawing.
    var tex0 = new Texture(context, 1, 1);

    var mouseX = 0, 
        mouseY = 0,
        time = 0;

    window.addEventListener("mousemove", function(ev) {
        mouseX = ev.pageX / canvas.width;
        mouseY = 1.0 - ev.pageY / canvas.height;
    }, true);

    var shader = new ShaderProgram(context, vertSrc, fragSrc);

    //sometimes the shader gives us useful warnings, even if it compiled successfully
    if (shader.log) 
        console.warn(shader.log);



    function render() {
        requestAnimationFrame(render);
        batch.shader = shader;

        batch.begin();
        shader.setUniformf("time", time+=0.01); 
        shader.setUniformf("mouse", mouseX, mouseY); 

        batch.draw(tex0, 0, 0, canvas.width, canvas.height);        

        batch.end();
    }   

    requestAnimationFrame(render);
}