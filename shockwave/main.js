var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;

var AssetManager = require('kami').AssetManager;
var SpriteBatch = require('kami').SpriteBatch;
var FrameBuffer = require('kami').FrameBuffer;
var TextureRegion = require('kami').TextureRegion;
var ShaderProgram = require('kami').ShaderProgram;

//include polyfill for requestAnimationFrame
require('raf.js');

var fs = require('fs');

//Load the shockwave shader... It's a very simple one from here:
//http://www.geeks3d.com/20091116/shader-library-2d-shockwave-post-processing-filter-glsl/

//See here for other ripple shaders:
//http://adrianboeing.blogspot.com/2011/02/ripple-effect-in-webgl.html
//http://www.patriciogonzalezvivo.com/blog/?p=657
var vert = fs.readFileSync( __dirname + "/shockwave.vert" );
var frag = fs.readFileSync( __dirname + "/shockwave.frag" );

domready(function() {
    var canvas = document.createElement("canvas");
    var width = 500;
    var height = 500;

    canvas.width = width;
    canvas.height = height;
    
    document.body.style.margin = "0";
    document.body.style.background = 'gray';
    document.body.appendChild(canvas);

    //create our WebGL context
    var context = new WebGLContext(width, height, canvas);

    var batch = new SpriteBatch(context);
    
    var grassTex = new Texture(context, "img/grass.png");
    grassTex.setFilter(Texture.Filter.LINEAR);
    grassTex.setWrap(Texture.Wrap.REPEAT);

    var npcTex = new Texture(context, "img/guy.png");

    var fbo = new FrameBuffer(context, width, height);
    var fboTexRegion = new TextureRegion(fbo.texture);
    fboTexRegion.flip(false, true);

    var shockwaveShader = new ShaderProgram(context, vert, frag);
    if (shockwaveShader.log)
        console.warn(shockwaveShader.log);

    var mouseX = 0, 
        mouseY = 0,
        time = 1000,
        playerTime = 0;

    window.addEventListener("mousedown", function(ev) {
        time = 0;
        mouseX = ev.pageX / canvas.width;
        mouseY = 1.0 - ev.pageY / canvas.height;
    }, true);


    function render() {
        requestAnimationFrame(render);
        var gl = context.gl;

        //start rendering to off-screen texture
        fbo.begin();

        //clear the FBO tex
        gl.clear(gl.COLOR_BUFFER_BIT);

        batch.shader = batch.defaultShader;
        batch.resize(fbo.width, fbo.height);
        batch.begin();

        //tile it to the canvas
        //this only works with POT repeat-wrapped textures. i.e. no sprite sheets
        var nrepeats = 2;
        batch.draw(grassTex, 0, 0, width, height,
                    0, 0, nrepeats, nrepeats);
        
        //animate one of the player's movements...
        var anim = Math.sin(playerTime+=0.02) * 100;

        //draw some player sprites ...
        batch.draw(npcTex, 105, 50, npcTex.width*2, npcTex.height*2);
        batch.draw(npcTex, 255, 350, npcTex.width*2, npcTex.height*2);
        batch.draw(npcTex, 300+anim, 150, npcTex.width*2, npcTex.height*2);

        batch.end();

        //stop rendering to FBO, and start rendering to screen
        fbo.end();


        //clear the screen
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        batch.shader = shockwaveShader;
        batch.resize(fbo.width, fbo.height);
        batch.begin();

        shockwaveShader.setUniformf("shockParams", 10.0, 0.7, 0.1);
        shockwaveShader.setUniformf("center", mouseX, mouseY);
        shockwaveShader.setUniformf("time", time += 0.025);

        batch.drawRegion(fboTexRegion, 0, 0);
        batch.end();
    }

    requestAnimationFrame(render);
});